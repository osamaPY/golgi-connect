-- =====================================================
-- Clean up duplicate bookings
-- Keep only the most recent booking for each combination
-- =====================================================
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY user_id, slot_id, booking_date, resource_type 
           ORDER BY created_at DESC
         ) as rn
  FROM public.bookings
  WHERE status = 'booked'
)
DELETE FROM public.bookings
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- =====================================================
-- Add performance indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_bookings_user_date ON public.bookings(user_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_date ON public.bookings(slot_id, booking_date, resource_type);

-- =====================================================
-- Prevent duplicate bookings with unique constraint
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_per_slot 
ON public.bookings(user_id, slot_id, booking_date, resource_type) 
WHERE status = 'booked';