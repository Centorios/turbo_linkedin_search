import type { StructuredCv } from "../types/cv";

export function MinimalistaAts({ cv }: { cv: StructuredCv }) {
  return (
    <article data-testid="template-minimalista-ats">
      <h2>{cv.personalInfo.fullName || "Nombre profesional"}</h2>
      <p>{[cv.personalInfo.email, cv.personalInfo.phone, cv.personalInfo.location].filter(Boolean).join(" | ")}</p>
      {cv.summary && <section><h3>Resumen</h3><p>{cv.summary}</p></section>}
      <section><h3>Experiencia</h3>{cv.experience.length ? cv.experience.map((item) => (
        <div key={`${item.company}-${item.title}`}><h4>{item.title} - {item.company}</h4><p>{item.startDate} - {item.endDate}</p><ul>{item.achievements.map((achievement) => <li key={achievement}>{achievement}</li>)}</ul></div>
      )) : <p>Sin experiencia registrada.</p>}</section>
      <section><h3>Educación</h3>{cv.education.length ? cv.education.map((item) => <p key={`${item.institution}-${item.program}`}>{item.program} - {item.institution}</p>) : <p>Sin educación registrada.</p>}</section>
      <section><h3>Habilidades</h3><p>{[...cv.skills.hard, ...cv.skills.soft].join(", ") || "Sin habilidades registradas."}</p></section>
    </article>
  );
}
