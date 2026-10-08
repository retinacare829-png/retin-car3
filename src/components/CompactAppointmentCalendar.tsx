import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { DashboardAppointment } from "../domain/dashboard";

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function CompactAppointmentCalendar({ appointments }: { appointments: DashboardAppointment[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = new Date();
  const todayKey = dateKey(today);
  const firstDay = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const rawMonthLabel = new Intl.DateTimeFormat("es-NI", { month: "long", year: "numeric" }).format(firstDay);
  const monthLabel = (rawMonthLabel[0]?.toLocaleUpperCase("es-NI") ?? "") + rawMonthLabel.slice(1);
  const appointmentsByDate = new Map<string, DashboardAppointment[]>();
  appointments.forEach((appointment) => appointmentsByDate.set(appointment.date, [...(appointmentsByDate.get(appointment.date) ?? []), appointment]));
  const overdueAppointments = appointments.filter((appointment) => appointment.date < todayKey).sort((a, b) => b.date.localeCompare(a.date));
  const upcomingAppointments = appointments.filter((appointment) => appointment.date >= todayKey);
  const visibleAppointments = selectedDate
    ? appointmentsByDate.get(selectedDate) ?? []
    : [...overdueAppointments.slice(0, 2), ...upcomingAppointments.slice(0, 4)].slice(0, 4);

  return <section className="home-calendar" aria-labelledby="home-calendar-title">
    <div className="home-calendar-heading"><div><p className="eyebrow">Agenda clínica</p><h2 id="home-calendar-title">Citas y seguimientos</h2></div><CalendarDays aria-hidden="true" size={19} /></div>
    <div className="home-calendar-month"><strong>{monthLabel}</strong><div><button aria-label="Mes anterior" onClick={() => { setMonthOffset((offset) => offset - 1); setSelectedDate(null); }} type="button"><ChevronLeft aria-hidden="true" size={17} /></button><button aria-label="Mes siguiente" onClick={() => { setMonthOffset((offset) => offset + 1); setSelectedDate(null); }} type="button"><ChevronRight aria-hidden="true" size={17} /></button></div></div>
    <div className="home-calendar-grid" role="group" aria-label={`Calendario de ${monthLabel}`}>
      {weekdays.map((weekday) => <span className="home-calendar-weekday" key={weekday}>{weekday}</span>)}
      {Array.from({ length: startOffset }, (_, index) => <span aria-hidden="true" key={`blank-${index}`} />)}
      {Array.from({ length: daysInMonth }, (_, index) => {
        const date = dateKey(new Date(firstDay.getFullYear(), firstDay.getMonth(), index + 1));
        const events = appointmentsByDate.get(date) ?? [];
        const urgent = events.some((event) => event.urgency === "urgent");
        return <button aria-label={`${index + 1} de ${monthLabel}${events.length ? `, ${events.length} cita${events.length === 1 ? "" : "s"}${urgent ? ", urgente" : ""}` : ""}`} aria-pressed={selectedDate === date} className={`${date === todayKey ? "today " : ""}${urgent ? "urgent " : ""}${events.length ? "has-events" : ""}`} key={date} onClick={() => setSelectedDate((current) => current === date ? null : date)} type="button"><span>{index + 1}</span>{events.length ? <i aria-hidden="true" /> : null}</button>;
      })}
    </div>
    <div className="home-calendar-list"><div className="home-calendar-list-heading"><strong>{selectedDate ? "Citas de este día" : "Pendientes y próximas"}</strong>{selectedDate ? <button onClick={() => setSelectedDate(null)} type="button">Ver próximas</button> : null}</div>
      {visibleAppointments.length ? <ul>{visibleAppointments.map((appointment) => <li key={appointment.id}><time dateTime={appointment.date}>{new Intl.DateTimeFormat("es-NI", { day: "numeric", month: "short" }).format(new Date(`${appointment.date}T12:00:00`))}</time><span><strong>{appointment.title}</strong><small>{appointment.detail}</small></span>{appointment.urgency === "urgent" ? <em>Urgente</em> : appointment.date < todayKey ? <em className="overdue">Vencida</em> : null}</li>)}</ul> : <p>{selectedDate ? "No hay citas registradas para este día." : "No hay citas o seguimientos próximos."}</p>}
    </div>
  </section>;
}
