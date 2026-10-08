-- La identidad del logo es una elección independiente del archivo guardado.
-- Los temas anteriores se conservan por compatibilidad con clínicas existentes.
alter table public.organizations
  drop constraint organizations_brand_theme_check,
  add constraint organizations_brand_theme_check
    check (brand_theme in ('retina', 'logo', 'ocean', 'violet', 'sunset'));
