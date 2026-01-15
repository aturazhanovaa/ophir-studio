import React from "react";
import { NavLink } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="footerGrid">
          <div>
            <div className="footerTitle">Solutions</div>
            <NavLink className="footerLink" to="/knowledge-base?area=services">
              Security analytics
            </NavLink>
            <NavLink className="footerLink" to="/knowledge-base?area=outreach">
              Enablement workflows
            </NavLink>
            <NavLink className="footerLink" to="/case-studies">
              Proof library
            </NavLink>
          </div>
          <div>
            <div className="footerTitle">Industries</div>
            <NavLink className="footerLink" to="/knowledge-base?area=industries">
              Verticals overview
            </NavLink>
            <NavLink className="footerLink" to="/knowledge-base">
              Sector filters
            </NavLink>
          </div>
          <div>
            <div className="footerTitle">Resources</div>
            <NavLink className="footerLink" to="/knowledge-base">
              Knowledge base
            </NavLink>
            <NavLink className="footerLink" to="/playground">
              Draft playground
            </NavLink>
          </div>
          <div>
            <div className="footerTitle">Company</div>
            <span className="footerLink">Careers</span>
            <span className="footerLink">Press</span>
            <span className="footerLink">Partners</span>
          </div>
          <div>
            <div className="footerTitle">Support</div>
            <NavLink className="footerLink" to="/access">
              Access center
            </NavLink>
            <span className="footerLink">Help desk</span>
          </div>
          <div>
            <div className="footerTitle">Legal</div>
            <span className="footerLink">Privacy</span>
            <span className="footerLink">Security</span>
            <span className="footerLink">Terms</span>
          </div>
        </div>
        <div className="footerBottom">
          <span>(c) {new Date().getFullYear()} All rights reserved.</span>
          <span>Enterprise-grade security and analytics workspace.</span>
        </div>
      </div>
    </footer>
  );
}
