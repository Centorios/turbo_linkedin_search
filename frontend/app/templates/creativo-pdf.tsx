import type { StructuredCv } from "../types/cv";

export function CreativoPdf({ cv }: { cv: StructuredCv }) {
  return (
    <article data-testid="template-creativo-pdf">
      <header><p>Perfil profesional</p><h2>{cv.personalInfo.fullName || "Nombre profesional"}</h2><p>{cv.summary || ""}</p></header>
      <section><h3>Trayectoria</h3>{cv.experience.length ? cv.experience.map((item) => <div key={`${item.company}-${item.title}`}><h4>{item.title}</h4><p>{item.company} · {item.location}</p><p>{item.achievements.join(" · ")}</p></div>) : <p>Sin experiencia registrada.</p>}</section>
      <section><h3>Competencias</h3><p>{[...cv.skills.hard, ...cv.skills.soft].join(" · ") || "Sin habilidades registradas."}</p></section>
      <section><h3>Formación</h3>{cv.education.length ? cv.education.map((item) => <p key={`${item.institution}-${item.program}`}>{item.program}, {item.institution}</p>) : <p>Sin educación registrada.</p>}</section>
    </article>
  );
}
