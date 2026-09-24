import { PageShell } from '../components/PageShell'

export function ContactPage(){
  return <PageShell eyebrow="Contact" title="Contact" intro="Have feedback, questions, or want to share College Cost & Aid Navigator with students or families? Feel free to reach out.">
    <article className="card max-w-4xl p-6 leading-8 sm:p-9">
      <dl className="grid gap-5">
        <div>
          <dt className="font-bold text-ink-950">Name</dt>
          <dd>Abhinav Ramakrishnan</dd>
        </div>
        <div>
          <dt className="font-bold text-ink-950">Email</dt>
          <dd><a href="mailto:abhinavkrishna1008@gmail.com">abhinavkrishna1008@gmail.com</a></dd>
        </div>
      </dl>
    </article>
  </PageShell>
}
