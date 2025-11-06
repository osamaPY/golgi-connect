-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user roles enum
CREATE TYPE app_role AS ENUM ('resident', 'staff', 'admin');

-- Create resource types enum
CREATE TYPE resource_type AS ENUM ('LAV', 'ASC', 'GYM');

-- Create booking status enum
CREATE TYPE booking_status AS ENUM ('booked', 'cancelled', 'no_show');

-- Create parcel status enum
CREATE TYPE parcel_status AS ENUM ('arrived', 'notified', 'picked_up');

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_number)
);

-- Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'resident',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create news table
CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  title_en TEXT,
  content TEXT NOT NULL,
  content_en TEXT,
  is_pinned BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create slots table (defines available time slots)
CREATE TABLE public.slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_type resource_type NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INTEGER DEFAULT 2,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.slots(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  resource_type resource_type NOT NULL,
  status booking_status DEFAULT 'booked',
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create weekly_quotas table (tracks LAV/ASC usage per week)
CREATE TABLE public.weekly_quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  lav_count INTEGER DEFAULT 0,
  asc_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, week_number)
);

-- Create parcels table
CREATE TABLE public.parcels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  carrier TEXT,
  tracking_number TEXT,
  notes TEXT,
  status parcel_status DEFAULT 'arrived',
  arrived_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  handled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create settings table
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view all roles"
  ON public.user_roles FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for news
CREATE POLICY "Everyone can view published news"
  ON public.news FOR SELECT
  USING (published_at IS NOT NULL AND published_at <= NOW());

CREATE POLICY "Admins can manage news"
  ON public.news FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for slots
CREATE POLICY "Everyone can view active slots"
  ON public.slots FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage slots"
  ON public.slots FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for bookings
CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all bookings"
  ON public.bookings FOR SELECT
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel own bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can manage all bookings"
  ON public.bookings FOR ALL
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for weekly_quotas
CREATE POLICY "Users can view own quotas"
  ON public.weekly_quotas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage quotas"
  ON public.weekly_quotas FOR ALL
  USING (true);

-- RLS Policies for parcels
CREATE POLICY "Users can view own parcels"
  ON public.parcels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can manage all parcels"
  ON public.parcels FOR ALL
  USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for audit_log
CREATE POLICY "Admins can view audit log"
  ON public.audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit log"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- RLS Policies for settings
CREATE POLICY "Everyone can view settings"
  ON public.settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage settings"
  ON public.settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_news_updated_at
  BEFORE UPDATE ON public.news
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, room_number, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'room_number', '000'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email
  );
  
  -- Assign default resident role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'resident');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert default slots for laundry (2 LAV machines, 1 ASC machine)
INSERT INTO public.slots (resource_type, day_of_week, start_time, end_time, capacity) VALUES
  -- Monday LAV (2 machines)
  ('LAV', 1, '08:00', '09:30', 2),
  ('LAV', 1, '09:30', '11:00', 2),
  ('LAV', 1, '11:00', '12:30', 2),
  ('LAV', 1, '12:30', '14:00', 2),
  ('LAV', 1, '14:00', '15:30', 2),
  ('LAV', 1, '15:30', '17:00', 2),
  ('LAV', 1, '17:00', '18:30', 2),
  ('LAV', 1, '18:30', '20:00', 2),
  ('LAV', 1, '20:00', '21:30', 2),
  ('LAV', 1, '21:30', '23:00', 2),
  -- Monday ASC (1 machine)
  ('ASC', 1, '08:00', '09:30', 1),
  ('ASC', 1, '09:30', '11:00', 1),
  ('ASC', 1, '11:00', '12:30', 1),
  ('ASC', 1, '12:30', '14:00', 1),
  ('ASC', 1, '14:00', '15:30', 1),
  ('ASC', 1, '15:30', '17:00', 1),
  ('ASC', 1, '17:00', '18:30', 1),
  ('ASC', 1, '18:30', '20:00', 1),
  ('ASC', 1, '20:00', '21:30', 1),
  ('ASC', 1, '21:30', '23:00', 1);

-- Repeat for other days (Tuesday-Sunday)
-- I'll add a function to seed all days to keep migration shorter

-- Insert sample news
INSERT INTO public.news (title, title_en, content, content_en, is_pinned, published_at) VALUES
  (
    'Benvenuti al Collegio Golgi',
    'Welcome to Collegio Golgi',
    'Benvenuti al nuovo portale dei residenti! Qui puoi prenotare lavanderia, palestra e controllare i tuoi pacchi.',
    'Welcome to the new resident portal! Here you can book laundry, gym and check your parcels.',
    true,
    NOW()
  ),
  (
    'Regole della Lavanderia',
    'Laundry Rules',
    'Ricorda: massimo 3 LAV e 2 ASC a settimana. Non sovrascrivere le prenotazioni altrui!',
    'Remember: maximum 3 LAV and 2 ASC per week. Do not overwrite others'' reservations!',
    false,
    NOW()
  );

-- Insert default settings
INSERT INTO public.settings (key, value) VALUES
  ('laundry_rules', '{"max_lav_per_week": 3, "max_asc_per_week": 2}'::jsonb),
  ('gym_rules', '{"slot_duration_minutes": 90, "max_active_bookings": 1, "capacity_per_slot": 6}'::jsonb),
  ('system', '{"timezone": "Europe/Rome", "default_locale": "it"}'::jsonb);