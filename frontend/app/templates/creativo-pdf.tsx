import type { PartialDate, StructuredCv } from "../types/cv";

function formatDateRange(startDate: PartialDate, endDate: PartialDate): string {
  return [startDate, endDate].filter(Boolean).join(" - ");
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-label-xs uppercase tracking-wider text-primary">{children}</h3>;
}

function EmptyState({ children }: { children: string }) {
  return <p className="mt-1.5 text-caption-xs italic text-text-muted">{children}</p>;
}

export function CreativoPdf({ cv }: { cv: StructuredCv }) {
  const contact = [cv.personalInfo.email, cv.personalInfo.phone, cv.personalInfo.location, cv.personalInfo.linkedin, cv.personalInfo.website]
    .filter(Boolean)
    .join("  ·  ");
  const skills = [...cv.skills.hard, ...cv.skills.soft].join(" · ");
  const languages = cv.languages.map((language) => [language.name, language.proficiency].filter(Boolean).join(" - ")).join(" · ");

  return (
    <article data-testid="template-creativo-pdf" className="flex flex-col gap-4 text-text">
      <header className="border-l-4 border-primary pl-4">
        <p className="text-label-xs uppercase tracking-wider text-primary">Perfil profesional</p>
        <h2 className="mt-1 text-headline-2xl font-bold text-text">{cv.personalInfo.fullName || "Nombre profesional"}</h2>
        {contact && <p className="mt-1 text-body-sm text-text-muted">{contact}</p>}
        {cv.summary && <p className="mt-2 text-body-sm leading-relaxed text-text">{cv.summary}</p>}
      </header>

      <section>
        <SectionTitle>Trayectoria</SectionTitle>
        {cv.experience.length ? (
          <div className="mt-2 flex flex-col gap-3">
            {cv.experience.map((item) => (
              <div key={`${item.company}-${item.title}`}>
                <p className="text-body-sm font-semibold text-text">{item.title}</p>
                {(item.company || item.location) && (
                  <p className="text-caption-xs text-text-muted">{[item.company, item.location].filter(Boolean).join(" · ")}</p>
                )}
                {formatDateRange(item.startDate, item.endDate) && (
                  <p className="text-caption-xs text-text-muted">{formatDateRange(item.startDate, item.endDate)}</p>
                )}
                {item.achievements.length > 0 && (
                  <p className="mt-1 text-body-sm text-text">{item.achievements.join(" · ")}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>Sin experiencia registrada.</EmptyState>
        )}
      </section>

      <section>
        <SectionTitle>Competencias</SectionTitle>
        {skills ? <p className="mt-1.5 text-body-sm text-text">{skills}</p> : <EmptyState>Sin habilidades registradas.</EmptyState>}
      </section>

      <section>
        <SectionTitle>Formación</SectionTitle>
        {cv.education.length ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {cv.education.map((item) => (
              <p key={`${item.institution}-${item.program}`} className="text-body-sm text-text">
                {[item.program, item.institution].filter(Boolean).join(", ")}
                {formatDateRange(item.startDate, item.endDate) && (
                  <span className="text-caption-xs text-text-muted"> · {formatDateRange(item.startDate, item.endDate)}</span>
                )}
              </p>
            ))}
          </div>
        ) : (
          <EmptyState>Sin educación registrada.</EmptyState>
        )}
      </section>

      <section>
        <SectionTitle>Idiomas</SectionTitle>
        {languages ? <p className="mt-1.5 text-body-sm text-text">{languages}</p> : <EmptyState>Sin idiomas registrados.</EmptyState>}
      </section>

      <section>
        <SectionTitle>Certificaciones</SectionTitle>
        {cv.certifications.length ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {cv.certifications.map((item) => (
              <p key={`${item.issuer}-${item.name}`} className="text-body-sm text-text">
                {item.name}
                {item.issuer && <span className="text-caption-xs text-text-muted"> · {item.issuer}</span>}
              </p>
            ))}
          </div>
        ) : (
          <EmptyState>Sin certificaciones registradas.</EmptyState>
        )}
      </section>
    </article>
  );
}
