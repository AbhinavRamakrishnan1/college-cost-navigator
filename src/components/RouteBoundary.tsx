import { Component,type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export class RouteBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  // Do not log errors: validation errors may contain private input values.
  render(){return this.state.failed?<section className="page-wrap py-12" role="alert"><h1 className="page-title">This view is unavailable</h1><p className="mt-4">Local data could not be read or validated, browser storage may be unavailable, or reference data failed to load. No estimate is shown and your data has not been deleted.</p><p className="mt-3">Reload to retry. If browser storage is disabled, enable it. You can review your backup and local data in Settings.</p><a className="button-secondary mt-4" href={window.location.pathname}>Reload this view</a><Link className="button-secondary ml-3 mt-4" to="/app/settings">Open Settings</Link></section>:this.props.children}
}
