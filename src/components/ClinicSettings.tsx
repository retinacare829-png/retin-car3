import { useEffect, useState } from "react";
import type { OrganizationContext } from "../services/organizationService";
import { paletteFromLogo, validateClinicLogo, type ClinicPalette, type ClinicTheme } from "../domain/clinicBranding";

interface Props {
  context: OrganizationContext;
  userEmail: string;
  onRegisterClinic: (name: string) => Promise<void>;
  onSaveBranding: (theme: ClinicTheme, logo: File | null) => Promise<void>;
}

export function ClinicSettings({ context, userEmail, onRegisterClinic, onSaveBranding }: Props) {
  const [logo, setLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPalette, setPreviewPalette] = useState<ClinicPalette | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLogo(null);
    setMessage(null);
    setError(null);
  }, [context.organization.id]);

  useEffect(() => {
    if (!logo) { setPreviewUrl(null); setPreviewPalette(null); return; }
    if (validateClinicLogo(logo)) { setPreviewUrl(null); setPreviewPalette(null); return; }
    let cancelled = false;
    const url = URL.createObjectURL(logo);
    setPreviewUrl(url);
    paletteFromLogo(logo).then((palette) => { if (!cancelled) setPreviewPalette(palette); })
      .catch(() => { if (!cancelled) setPreviewPalette(null); });
    return () => { cancelled = true; URL.revokeObjectURL(url); };
  }, [logo]);

  const logoError = logo ? validateClinicLogo(logo) : null;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = logo ? validateClinicLogo(logo) : null;
    if (!logo) { setError("Selecciona un logo para aplicar la identidad visual."); return; }
    if (validationError) { setError(validationError); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      await paletteFromLogo(logo);
      await onSaveBranding("retina", logo);
      setLogo(null);
      setMessage("Logo guardado. Los colores se ajustaron automáticamente a tu clínica.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la identidad visual.");
    } finally { setSaving(false); }
  }

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = clinicName.trim();
    if (name.length < 2 || name.length > 160) { setError("El nombre debe tener entre 2 y 160 caracteres."); return; }
    setRegistering(true); setError(null); setMessage(null);
    try {
      await onRegisterClinic(name);
      setClinicName("");
      setMessage("Clínica registrada. Su nombre ya aparece debajo del logo; puedes subir su propio logo ahora.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo registrar la clínica.");
    } finally { setRegistering(false); }
  }

  return <section className="clinic-settings simple-page" aria-labelledby="settings-title">
    <p className="eyebrow">Administración de clínica</p>
    <h1 id="settings-title">Configuración</h1>
    <p>El logo define automáticamente los colores de cada clínica. Sin logo se usan los colores de RetinaCare.</p>
    {error ? <p className="clinic-settings-error" role="alert">{error}</p> : null}
    {message ? <p className="clinic-settings-success" role="status">{message}</p> : null}
    <div className="clinic-settings-grid">
      <form className="info-card clinic-settings-form" onSubmit={(event) => void save(event)}>
        <h2>Identidad visual de {context.organization.name}</h2>
        <p>El logo se ajusta completo al panel lateral y el nombre de la clínica queda debajo. RetinaCare permanece en la barra superior.</p>
        <label className="clinic-logo-input">Logo de la clínica (JPG, PNG o WEBP; máximo 1 MB; proporción hasta 5:1)
          <input accept="image/jpeg,image/png,image/webp" onChange={(event) => setLogo(event.target.files?.[0] ?? null)} type="file" />
        </label>
        {logoError ? <small className="clinic-settings-error">{logoError}</small> : null}
        {previewUrl ? <div className="clinic-logo-preview"><img alt="Vista previa del logo seleccionado" src={previewUrl} /><div><strong>Colores del logo</strong>{previewPalette ? <span className="clinic-color-preview" aria-label="Vista previa de colores"><i style={{ background: previewPalette.primary }} /><i style={{ background: previewPalette.sidebar }} /><i style={{ background: previewPalette.accent }} /></span> : <small>Se calcularán al guardar.</small>}</div></div> : null}
        {logo ? <small>Seleccionado: {logo.name}</small> : context.organization.logoPath ? <small>Esta clínica ya tiene un logo guardado.</small> : <small>Aún no se ha subido un logo.</small>}
        <button className="primary-button" disabled={saving || registering || !logo || Boolean(logoError)} type="submit">{saving ? "Guardando…" : "Guardar logo y aplicar colores"}</button>
      </form>
      <div className="clinic-settings-side">
        <form className="info-card clinic-settings-form" onSubmit={(event) => void register(event)}>
          <h2>Registrar otra clínica</h2>
          <p>Se creará una clínica independiente y tu usuario quedará como su administrador inicial. Los demás accesos los gestiona soporte por separado.</p>
          <label>Nombre de la clínica<input maxLength={160} minLength={2} onChange={(event) => setClinicName(event.target.value)} required value={clinicName} /></label>
          <button className="secondary-button" disabled={saving || registering} type="submit">{registering ? "Registrando…" : "Registrar clínica"}</button>
        </form>
        <article className="info-card"><h2>Contexto de sesión</h2><dl className="settings-list"><div><dt>Organización</dt><dd>{context.organization.name}</dd></div><div><dt>Usuario</dt><dd>{userEmail}</dd></div><div><dt>Rol</dt><dd>Administrador de clínica</dd></div></dl></article>
      </div>
    </div>
  </section>;
}
