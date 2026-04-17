-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'caretaker', 'accountant', 'tenant');
CREATE TYPE public.unit_status AS ENUM ('vacant', 'occupied', 'reserved');
CREATE TYPE public.unit_type AS ENUM ('bedsitter', 'single', 'one_bedroom', 'two_bedroom', 'three_bedroom', 'shop', 'office', 'other');
CREATE TYPE public.lease_status AS ENUM ('active', 'ended', 'terminated');
CREATE TYPE public.payment_method AS ENUM ('cash', 'mpesa', 'bank_transfer', 'cheque', 'other');

-- =========================================
-- TIMESTAMP TRIGGER FUNCTION
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  business_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- USER ROLES (separate table for security)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: is the user a staff member (admin/manager/caretaker/accountant)?
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','manager','caretaker','accountant')
  )
$$;

-- =========================================
-- HANDLE NEW USER (auto profile + first user becomes admin)
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );

  -- First user in the system becomes admin
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- PROPERTIES
-- =========================================
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- UNITS
-- =========================================
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit_type unit_type NOT NULL DEFAULT 'bedsitter',
  rent_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status unit_status NOT NULL DEFAULT 'vacant',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, name)
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_units_updated_at BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_units_property ON public.units(property_id);

-- =========================================
-- TENANTS
-- =========================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  national_id TEXT,
  phone TEXT,
  email TEXT,
  next_of_kin_name TEXT,
  next_of_kin_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- LEASES
-- =========================================
CREATE TABLE public.leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE,
  rent_amount NUMERIC(12,2) NOT NULL,
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status lease_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_leases_updated_at BEFORE UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_leases_tenant ON public.leases(tenant_id);
CREATE INDEX idx_leases_unit ON public.leases(unit_id);

-- =========================================
-- PAYMENTS
-- =========================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  method payment_method NOT NULL DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_payments_lease ON public.payments(lease_id);
CREATE INDEX idx_payments_paid_on ON public.payments(paid_on);

-- =========================================
-- RLS POLICIES
-- =========================================

-- PROFILES
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Staff view all profiles" ON public.profiles
  FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- USER ROLES
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PROPERTIES (staff only)
CREATE POLICY "Staff view properties" ON public.properties
  FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin/Manager insert properties" ON public.properties
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY "Admin/Manager update properties" ON public.properties
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY "Admin delete properties" ON public.properties
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- UNITS
CREATE POLICY "Staff view units" ON public.units
  FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Tenant view own unit" ON public.units
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.tenants t ON t.id = l.tenant_id
      WHERE l.unit_id = units.id
        AND t.user_id = auth.uid()
        AND l.status = 'active'
    )
  );
CREATE POLICY "Admin/Manager manage units" ON public.units
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );

-- TENANTS
CREATE POLICY "Staff view tenants" ON public.tenants
  FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Tenant view own record" ON public.tenants
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin/Manager manage tenants" ON public.tenants
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );

-- LEASES
CREATE POLICY "Staff view leases" ON public.leases
  FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Tenant view own leases" ON public.leases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = leases.tenant_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Admin/Manager manage leases" ON public.leases
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );

-- PAYMENTS
CREATE POLICY "Staff view payments" ON public.payments
  FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Tenant view own payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.tenants t ON t.id = l.tenant_id
      WHERE l.id = payments.lease_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "Admin/Manager/Accountant insert payments" ON public.payments
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'accountant')
  );
CREATE POLICY "Admin/Manager/Accountant update payments" ON public.payments
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'accountant')
  );
CREATE POLICY "Admin delete payments" ON public.payments
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));