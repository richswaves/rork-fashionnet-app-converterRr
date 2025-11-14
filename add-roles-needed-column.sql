-- Add missing columns to opportunities table for multiple roles support

-- Add roles_needed column as text array
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'opportunities' 
    AND column_name = 'roles_needed'
  ) THEN
    ALTER TABLE public.opportunities ADD COLUMN roles_needed text[];
  END IF;
END $$;

-- Add type column (for backward compatibility with existing queries)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'opportunities' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE public.opportunities ADD COLUMN type text;
  END IF;
END $$;

-- Add budget column (to replace compensation)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'opportunities' 
    AND column_name = 'budget'
  ) THEN
    ALTER TABLE public.opportunities ADD COLUMN budget text;
  END IF;
END $$;

-- Add company column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'opportunities' 
    AND column_name = 'company'
  ) THEN
    ALTER TABLE public.opportunities ADD COLUMN company text;
  END IF;
END $$;

-- Add image_url column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'opportunities' 
    AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.opportunities ADD COLUMN image_url text;
  END IF;
END $$;

-- Rename cover_image to image_url if cover_image exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'opportunities' 
    AND column_name = 'cover_image'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'opportunities' 
    AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.opportunities RENAME COLUMN cover_image TO image_url;
  END IF;
END $$;

-- Change requirements column to text array if it's not already
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'opportunities' 
    AND column_name = 'requirements'
    AND data_type != 'ARRAY'
  ) THEN
    ALTER TABLE public.opportunities 
    ALTER COLUMN requirements TYPE text[] 
    USING CASE 
      WHEN requirements IS NULL THEN NULL 
      ELSE ARRAY[requirements]
    END;
  END IF;
END $$;

-- Create an index on roles_needed for better search performance
CREATE INDEX IF NOT EXISTS idx_opportunities_roles_needed ON public.opportunities USING GIN (roles_needed);

-- Create an index on type for better search performance
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON public.opportunities(type);

-- Add comment explaining the roles_needed column
COMMENT ON COLUMN public.opportunities.roles_needed IS 'Array of role types needed for this opportunity (e.g., [''Photographer'', ''Model''])';
COMMENT ON COLUMN public.opportunities.type IS 'Comma-separated string of role types for backward compatibility';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON opportunities TO authenticated;
