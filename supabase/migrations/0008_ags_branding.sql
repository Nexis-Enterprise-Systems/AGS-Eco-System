-- AGS Eco System: brand defaults taken from the AGS website (public/css/site.css).
-- Light theme tokens as "R G B" triplets:
--   primary   #1B1D1F  charcoal (solid buttons, active nav)
--   secondary #1B1D1F  charcoal
--   accent    #6E5D3F  bronze
--   surface   #FFFFFF
--   surface_muted #F4F3F0 (page background)
--   ink       #1B1D1F
--   ink_muted #5E6266
-- Fonts (Cormorant Garamond headlines, Jost body) are set in the app, not the DB.

alter table public.business_units alter column company_name set default 'AGS Decorating & Refurbishment Services';
alter table public.business_units alter column color_primary set default '27 29 31';
alter table public.business_units alter column color_secondary set default '27 29 31';
alter table public.business_units alter column color_accent set default '110 93 63';
alter table public.business_units alter column color_surface set default '255 255 255';
alter table public.business_units alter column color_surface_muted set default '244 243 240';
alter table public.business_units alter column color_ink set default '27 29 31';
alter table public.business_units alter column color_ink_muted set default '94 98 102';

update public.business_units
set company_name = 'AGS Decorating & Refurbishment Services',
    use_custom_branding = true,
    color_primary = '27 29 31',
    color_secondary = '27 29 31',
    color_accent = '110 93 63',
    color_surface = '255 255 255',
    color_surface_muted = '244 243 240',
    color_ink = '27 29 31',
    color_ink_muted = '94 98 102'
where is_head_office = true;

-- system_settings is still read by some screens until spec Phase 6 retires it; keep it in step.
alter table public.system_settings alter column color_primary set default '27 29 31';
alter table public.system_settings alter column color_secondary set default '27 29 31';
alter table public.system_settings alter column color_accent set default '110 93 63';
alter table public.system_settings alter column color_surface set default '255 255 255';
alter table public.system_settings alter column color_surface_muted set default '244 243 240';
alter table public.system_settings alter column color_ink set default '27 29 31';
alter table public.system_settings alter column color_ink_muted set default '94 98 102';
update public.system_settings
set company_name = 'AGS Decorating & Refurbishment Services',
    color_primary = '27 29 31', color_secondary = '27 29 31', color_accent = '110 93 63',
    color_surface = '255 255 255', color_surface_muted = '244 243 240',
    color_ink = '27 29 31', color_ink_muted = '94 98 102';
