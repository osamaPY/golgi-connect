-- =====================================================
-- Add units column to bookings table
-- This allows LAV bookings to reserve 1 or 2 washers
-- ASC and GYM always use 1 unit
-- =====================================================
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS units integer NOT NULL DEFAULT 1;

-- =====================================================
-- Add check constraint to ensure units is valid
-- LAV can be 1 or 2, ASC and GYM must be 1
-- =====================================================
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_units_check 
CHECK (
  (resource_type = 'LAV' AND units IN (1, 2)) OR
  (resource_type IN ('ASC', 'GYM') AND units = 1)
);

-- =====================================================
-- Add index for better performance when counting units
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_bookings_user_week_resource 
ON public.bookings(user_id, resource_type, booking_date, status);