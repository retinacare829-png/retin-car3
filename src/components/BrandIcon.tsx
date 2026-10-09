type BrandSymbol = "tamizaje" | "analisis" | "cargar" | "paciente" | "expediente" | "cita" | "historial" | "alerta" | "validado" | "reporte" | "estadistica" | "sincronizar" | "referir" | "institucion" | "sin-red" | "ajustes";

/** Official 24px brand artwork; the mask inherits the surrounding UI color. */
export function BrandIcon({ name, size = 22 }: { name: BrandSymbol; size?: number }) {
  return <span aria-hidden="true" className="brand-icon" style={{
    width: size, height: size, maskImage: `url(/brand/icons/icono_${name}.svg)`,
  }} />;
}
