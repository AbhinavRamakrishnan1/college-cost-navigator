import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter,Route,Routes } from 'react-router-dom'
import { describe,expect,it } from 'vitest'
import { AboutPage } from './AboutPage'
import { AidOfferDecoderPage } from './AidOfferDecoderPage'

describe('v1.1 final information pages',()=>{
  it('renders the builder and exact standalone disclaimer with working navigation',async()=>{const user=userEvent.setup();render(<MemoryRouter initialEntries={['/about']}><Routes><Route path="/about" element={<AboutPage/>}/><Route path="/methodology" element={<h1>Methodology destination</h1>}/></Routes></MemoryRouter>);expect(screen.getByRole('heading',{name:'About the Builder'})).toBeVisible();expect(screen.getByText(/My name is Abhinav Ramakrishnan/)).toBeVisible();expect(screen.getByText('College Cost & Aid Navigator is a standalone tool and is not endorsed or sponsored by the U.S. Department of Education, Federal Student Aid or any of the colleges in this application.')).toBeVisible();await user.click(screen.getByRole('link',{name:'Methodology and data sources'}));expect(screen.getByRole('heading',{name:'Methodology destination'})).toBeVisible()})
  it('explains essential offer terms and ownership distinctions',()=>{render(<AidOfferDecoderPage/>);for(const term of ['Cost of Attendance','Federal Pell Grant','Work-study','Direct Subsidized Loan','Direct Unsubsidized Loan','Parent PLUS','Student Aid Index','Net price','Loan origination fee'])expect(screen.getByText(term)).toBeVisible();expect(screen.getByText(/not an upfront grant/)).toBeVisible();expect(screen.getByText(/owed by the parent borrower/)).toBeVisible();expect(screen.getByText(/SAI is not a bill/)).toBeVisible();expect(screen.getByText(/historical average, not your personalized net price/)).toBeVisible()})
})
