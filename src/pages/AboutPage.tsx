import { Link } from 'react-router-dom'
import { PageShell } from '../components/PageShell'

export function AboutPage(){
  return <PageShell eyebrow="About" title="About the Builder" intro="College Cost & Aid Navigator · v1.1 release candidate">
    <article className="card max-w-4xl space-y-5 p-6 leading-8 sm:p-9">
      <p>My name is Abhinav Ramakrishnan, I am a senior in high school and a technology and finance enthusiast.</p>
      <p>Most students spend a lot of time thinking about college, including how to get in to a great school, what to put in that application, and agonizing over acceptance. But there is an equally important question that we all spend less time worrying about – how much is that college going to cost?</p>
      <p>Most students don't even come to grips with that question until after they've been admitted - and then they find themselves quickly thumbing through each website, loan calculator, aid offer, and financial statement, trying to sort through tuition, aid, loans, family splits, and amortization schedules. I wanted to ask much, much earlier - why wait until decision season to find out if a college could be affordable?</p>
      <p>This led to College Cost & Aid Navigator.</p>
      <p>I built this project to give students a single place to see the key elements that factor into college affordability. The Navigator moves beyond published tuition alone by showing you how the interplay between financial aid, loan limits, family contribution, and repayment assumptions paint a more accurate picture of what going to a college might cost.</p>
      <p>Finally, I wanted it to be clear and honest. College Cost & Aid Navigator does not rate the affordability of a college or rank colleges for students. It lays out the numbers, assumptions, and tradeoffs so students and families can make their own financial judgment about their options.</p>
      <p>Completing the project has meant I've been able to bring together many of the areas that I am most passionate about, for example; financial analysis, software development, data, and personal finance. But above all, it has provided me the chance to build something to address an issue that students like us might, in the near future, have to deal with ourselves.</p>
      <p>College Cost & Aid Navigator is a standalone tool and is not endorsed or sponsored by the U.S. Department of Education, Federal Student Aid or any of the colleges in this application.</p>
    </article>
    <aside className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Project information">
      <div className="card p-5"><h2 className="font-serif text-xl font-bold">Privacy first</h2><p className="mt-2">Household and planner inputs stay in your browser. The funding planner is ephemeral and clears on reload.</p></div>
      <div className="card p-5"><h2 className="font-serif text-xl font-bold">Project references</h2><p className="mt-2 flex flex-wrap gap-4"><Link to="/methodology">Methodology and data sources</Link><Link to="/privacy">Privacy</Link><a href="https://github.com/AbhinavRamakrishnan1/college-cost-navigator">GitHub repository</a></p></div>
    </aside>
  </PageShell>
}
