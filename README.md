# Collegio Golgi Booking System

Internal booking portal for Collegio Camillo Golgi residents in Pavia, Italy. Handles laundry, gym bookings and parcel management.

## Features

- **Laundry Booking**: Book washing machines (LAV) and dryers (ASC) with weekly quotas
- **Gym Booking**: Reserve 90-minute gym slots with capacity management
- **Parcel Management**: Track incoming parcels and pickup status
- **Multi-language**: Italian and English support
- **Role-based Access**: Resident, Staff, and Admin roles with different permissions

## Tech Stack

- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS + shadcn/ui for styling
- React Query for data fetching
- Supabase for backend (authentication, database, real-time)
- React Router for navigation
- date-fns for date manipulation

## Getting Started

### Prerequisites

- Node.js 18+ and npm (install with [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd collegio-golgi-portal

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

## Developer Notes

### Project Structure

- `/src/pages/` - Main page components (Laundry, Gym, Parcels, etc.)
- `/src/components/` - Reusable UI components
- `/src/contexts/` - React contexts (Auth, Locale)
- `/src/lib/` - Utility functions and i18n
- `/src/integrations/supabase/` - Supabase client and types

### Key Features

#### Booking Logic

- **Laundry**: 
  - Max 3 washers (LAV) + 2 dryers (ASC) per ISO week
  - Machine capacity: 2× LAV, 1× ASC
  - Weekly quota tracked in `weekly_quotas` table

- **Gym**: 
  - Max 1 active future booking per user
  - 90-minute slots from 07:00-23:00
  - Capacity of 6 per slot (configurable in DB)

#### Database Tables

- `profiles` - User profile information
- `user_roles` - Role assignments (resident, staff, admin)
- `slots` - Available time slots for each resource type
- `bookings` - All user bookings with status tracking
- `weekly_quotas` - Laundry booking counts per user/week
- `parcels` - Parcel tracking and pickup management

#### Role-Based Access Control

- **Resident**: Book laundry/gym, view own parcels, view news
- **Staff**: All resident features + manage parcels
- **Admin**: All staff features + user management, news, settings

### Deployment

Build the production version:

```sh
npm run build
```

The built files will be in the `/dist` directory.

## Contributing

This is an internal project for Collegio Golgi. For questions or issues, contact the IT administrator.

## License

© Collegio Camillo Golgi, University of Pavia, 2025. All rights reserved.
