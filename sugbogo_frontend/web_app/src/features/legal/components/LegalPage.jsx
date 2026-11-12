import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

export default function LegalPage({ title, description, children }) {
  useDocumentTitle(`${title} | SugboGo`);

  return (
    <article className="rounded-xl border border-stroke bg-background px-5 py-7 sm:px-10 sm:py-10 lg:px-14">
      <header className="max-w-prose">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-base leading-7">{description}</p>
        <p className="mt-5 border-l-2 border-primary py-1 pl-3 text-sm leading-6">
          Draft pending project approval
        </p>
      </header>

      <div className="mt-7 space-y-7 border-t border-stroke pt-7 text-base leading-7 [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_section]:max-w-prose [&_section>*+*]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}
