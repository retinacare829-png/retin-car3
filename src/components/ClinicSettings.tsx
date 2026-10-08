import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { FolderOpen, ImagePlus, UploadCloud } from "lucide-react";
import type { OrganizationContext } from "../services/organizationService";
import { clinicThemes, paletteFromLogo, validateClinicLogo, type ClinicPalette, type ClinicTheme } from "../domain/clinicBranding";

type PaletteChoice = "retina" | "logo";

interface Props {
  context: OrganizationContext;
  savedLogoPalette: ClinicPalette | null;
  userEmail: string;
  onRegisterClinic: (name: string) => Promise<void>;
  onSaveBranding: (theme: ClinicTheme, logo: File | null) => Promise<void>;
}

function PaletteSwatches({ colors }: { colors: readonly string[] }) {
  return <span className="clinic-palette-swatches">{colors.map((color, index) =>
    <span className="clinic-palette-color" key={`${color}-${index}`}>
      <i style={{ backgroundColor: color }} aria-hidden="true" /><small>{color}</small>
    </span>,
  )}</span>;
}

export function ClinicSettings({ context, savedLogoPalette, userEmail, onRegisterClinic, onSaveBranding }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPalette, setPreviewPalette] = useState<ClinicPalette | null>(null);
  const [paletteError, setPaletteError] = useState<string | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<PaletteChoice>(context.organization.brandTheme === "logo" ? "logo" : "retina");
  const [dragActive, setDragActive] = useState(false);
  const [clinicName, setClinicName] = useState("");
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLogo(null);
    setDragActive(false);
    setMessage(null);
    setError(null);
  }, [context.organization.id]);

  useEffect(() => {
    setSelectedPalette(context.organization.brandTheme === "logo" ? "logo" : "retina");
  }, [context.organization.id, context.organization.brandTheme]);

  useEffect(() => {
    if (!logo) { setPreviewUrl(null); setPreviewPalette(null); setPaletteError(null); return; }
    if (validateClinicLogo(logo)) { setPreviewUrl(null); setPreviewPalette(null); setPaletteError(null); return; }
    let cancelled = false;
    const url = URL.createObjectURL(logo);
    setPreviewUrl(url);
    setPreviewPalette(null);
    setPaletteError(null);
    paletteFromLogo(logo).then((palette) => { if (!cancelled) setPreviewPalette(palette); })
      .catch((caught: unknown) => { if (!cancelled) setPaletteError(caught instanceof Error ? caught.message : "No pudimos leer los colores del logo."); });
    return () => { cancelled = true; URL.revokeObjectURL(url); };
  }, [logo]);

  const logoError = logo ? validateClinicLogo(logo) : null;
  const logoPalette = logo ? previewPalette : savedLogoPalette;
  const canUseLogoColors = Boolean(logoPalette);
  const canSave = !saving && !registering && !logoError && !paletteError
    && (selectedPalette === "retina" || canUseLogoColors)
    && (Boolean(logo) || selectedPalette !== context.organization.brandTheme);

  function chooseLogo(file: File | null) {
    if (!file || saving || registering) return;
    setLogo(file);
    setError(null);
    setMessage(null);
  }

  function dragOver(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files") || saving || registering) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  }

  function dropLogo(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDragActive(false);
    chooseLogo(event.dataTransfer.files[0] ?? null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (logoError || paletteError) { setError(logoError ?? paletteError); return; }
    if (selectedPalette === "logo" && !canUseLogoColors) {
      setError("Subí un logo válido para usar sus colores."); return;
    }
    if (!logo && selectedPalette === context.organization.brandTheme) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      await onSaveBranding(selectedPalette, logo);
      setLogo(null);
      setMessage(selectedPalette === "logo"
        ? "Identidad guardada. La clínica usa los colores de su logo."
        : "Identidad guardada. La clínica conserva los colores RetinaCare.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la identidad visual.");
    } finally { setSaving(false); }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
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
    <p>Elegí si tu clínica conserva los colores RetinaCare o usa los colores extraídos de su logo.</p>
    {error ? <p className="clinic-settings-error" role="alert">{error}</p> : null}
    {message ? <p className="clinic-settings-success" role="status">{message}</p> : null}
    <div className="clinic-settings-grid">
      <form className="info-card clinic-settings-form" onSubmit={(event) => void save(event)}>
        <h2>Identidad visual de {context.organization.name}</h2>
        <p>El logo se verá completo en el panel lateral, con el nombre de la clínica debajo. RetinaCare permanece en la barra superior.</p>

        <div className={`clinic-folder-dropzone${dragActive ? " is-dragging" : ""}`}
          onDragEnter={dragOver} onDragOver={dragOver}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }}
          onDrop={dropLogo}>
          <div className="clinic-folder-art" aria-hidden="true"><span /><span /><FolderOpen size={54} strokeWidth={1.5} /></div>
          <div className="clinic-folder-copy"><strong>Logo de la clínica</strong><span className="clinic-drop-instruction">Arrastrá aquí la imagen desde tu computadora</span><small>JPG, PNG o WEBP · hasta 1 MB · proporción máxima 5:1</small></div>
          <input ref={fileInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp"
            aria-label="Seleccionar logo de la clínica"
            onChange={(event) => { chooseLogo(event.target.files?.[0] ?? null); event.target.value = ""; }} />
          <button className="clinic-folder-button" type="button" disabled={saving || registering}
            onClick={() => fileInputRef.current?.click()}><ImagePlus aria-hidden="true" size={18} /> Elegir logo</button>
        </div>
        {logoError || paletteError ? <small className="clinic-settings-error" role="alert">{logoError ?? paletteError}</small> : null}
        {previewUrl ? <div className="clinic-logo-preview"><img alt="Vista previa del logo seleccionado" src={previewUrl} /><div><strong>{logo?.name}</strong><small>Vista previa antes de guardar</small></div></div> : null}
        {!logo && context.organization.logoPath ? <small>Esta clínica ya tiene un logo guardado. Podés conservarlo y cambiar solo los colores.</small> : null}

        <fieldset className="clinic-palette-picker">
          <legend>Paleta de colores</legend>
          <p>Elegí una opción. Podés cambiarla después sin volver a subir el logo.</p>
          <label className={`clinic-palette-option${selectedPalette === "retina" ? " is-selected" : ""}`}>
            <input type="radio" name="clinic-palette" value="retina" checked={selectedPalette === "retina"}
              onChange={() => setSelectedPalette("retina")} />
            <span><strong>Colores RetinaCare</strong><small>Predeterminados de la aplicación</small></span>
            <PaletteSwatches colors={[clinicThemes.retina.primary, clinicThemes.retina.accent, clinicThemes.retina.soft]} />
          </label>
          <label className={`clinic-palette-option${selectedPalette === "logo" ? " is-selected" : ""}${!canUseLogoColors ? " is-unavailable" : ""}`}>
            <input type="radio" name="clinic-palette" value="logo" checked={selectedPalette === "logo"}
              disabled={!canUseLogoColors} onChange={() => setSelectedPalette("logo")} />
            <span><strong>Colores del logo</strong><small>{canUseLogoColors ? "Extraídos de la imagen de tu clínica" : logo ? "Analizando logo…" : "Subí un logo para habilitarlos"}</small></span>
            {logoPalette ? <PaletteSwatches colors={[logoPalette.primary, logoPalette.sidebar, logoPalette.accent]} /> : null}
          </label>
        </fieldset>
        <button className="primary-button" disabled={!canSave} type="submit"><UploadCloud aria-hidden="true" size={18} />{saving ? "Guardando…" : "Guardar identidad visual"}</button>
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
