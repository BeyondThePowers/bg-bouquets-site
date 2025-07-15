-- Add Dynamic Pricing Support
-- This migration adds the price_per_bouquet setting to enable dynamic pricing

-- Insert the pricing setting with default value
INSERT INTO schedule_settings (setting_key, setting_value, description) 
VALUES ('price_per_bouquet', '35.00', 'Price charged per bouquet in CAD')
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description;

-- Verify the setting was added
SELECT setting_key, setting_value, description 
FROM schedule_settings 
WHERE setting_key = 'price_per_bouquet';
