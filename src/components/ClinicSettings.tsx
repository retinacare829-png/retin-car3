import { useEffect, useState } from "react";
import type { OrganizationContext } from "../services/organizationService";
import { clinicThemes, validateClinicLogo, type ClinicTheme } from "../domain/clinicBranding";

interface Props {
  context: OrganizationContext;
  userEmail: string;
  onRegisterClinic: (name: string) => Promise<void>;
  onSaveBranding: (theme: ClinicTheme, logo: File | null) => Promise<void>;
}

export function ClinicSettings({ context, userEmail, onRegisterClinic, onSaveBranding }: Props) {
  const [theme, setTheme] = useState<ClinicTheme>(context.organization.brandTheme ?? "retina");
  const [logo, setLogo] = useState<File | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTheme(context.organization.brandTheme ?? "retina");
    setLogo(null);
    setMessage(null);
    setError(null);
  }, [context.organization.id, context.organization.brandTheme]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = logo ? validateClinicLogo(logo) : null;
    if (validationError) { setError(validationError); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      await onSaveBranding(theme, logo);
      setLogo(null);
      setMessage("Identidad visual guardada para esta clínica.");
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
      setMessage("Clínica registrada. Ahora puedes personalizar sus colores y logo.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo registrar la clínica.");
    } finally { setRegistering(false); }
  }

  return <section className="clinic-settings simple-page" aria-labelledby="settings-title">
    <p className="eyebrow">Administración de clínica</p>
    <h1 id="settings-title">Configuración</h1>
    <p>Cada clínica conserva sus propios colores y logo. Solo los administradores pueden modificarlos.</p>
    {error ? <p className="clinic-settings-error" role="alert">{error}</p> : null}
    {message ? <p className="clinic-settings-success" role="status">{message}</p> : null}
    <div className="clinic-settings-grid">
      <form className="info-card clinic-settings-form" onSubmit={(event) => void save(event)}>
        <h2>Identidad visual de {context.organization.name}</h2>
        <p>El logo de tu clínica aparece en el panel lateral; RetinaCare permanece en la barra superior.</p>
        <fieldset className="clinic-theme-choices"><legend>Paleta de colores</legend>
          {(Object.entries(clinicThemes) as Array<[ClinicTheme, typeof clinicThemes[ClinicTheme]]>).map(([id, palette]) =>
            <label className={theme === id ? "clinic-theme-option selected" : "clinic-theme-option"} key={id}>
              <input checked={theme === id} name="clinic-theme" onChange={() => setTheme(id)} type="radio" value={id} />
              <span className="clinic-theme-swatch" style={{ background: palette.primary }} aria-hidden="true" />{palette.label}
            </label>)}
        </fieldset>
        <label className="clinic-logo-input">Logo de la clínica (JPG, PNG o WEBP; máximo 1 MB)
          <input accept="image/jpeg,image/png,image/webp" onChange={(event) => setLogo(event.target.files?.[0] ?? null)} type="file" />
        </label>
        {logo ? <small>Seleccionado: {logo.name}</small> : context.organization.logoPath ? <small>Esta clínica ya tiene un logo guardado.</small> : <small>Aún no se ha subido un logo.</small>}
        <button className="primary-button" disabled={saving || registering} type="submit">{saving ? "Guardando…" : "Guardar identidad visual"}</button>
      </form>
      <div className="clinic-settings-side">
        <form className="info-card clinic-settings-form" onSubmit={(event) => void register(event)}>
          <h2>Registrar otra clínica</h2>
          <p>Se creará una clínica independiente y tu usuario quedará como su administrador inicial.</p>
          <label>Nombre de la clínica<input maxLength={160} minLength={2} onChange={(event) => setClinicName(event.target.value)} required value={clinicName} /></label>
          <button className="secondary-button" disabled={saving || registering} type="submit">{registering ? "Registrando…" : "Registrar clínica"}</button>
        </form>
        <article className="info-card"><h2>Contexto de sesión</h2><dl className="settings-list"><div><dt>Organización</dt><dd>{context.organization.name}</dd></div><div><dt>Usuario</dt><dd>{userEmail}</dd></div><div><dt>Rol</dt><dd>Administrador de clínica</dd></div></dl></article>
      </div>
    </div>
  </section>;
}
