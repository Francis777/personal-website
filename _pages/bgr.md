---
layout: page
title: BGR
permalink: /bgr/
description: Interactive data projects about housing and wine in Bulgaria.
nav: false
nav_order: 2
---

<div class="bgr-landing">
  <p class="bgr-intro">Two interactive data projects for exploring Bulgaria. Choose a database to open the full-screen application.</p>

  <div class="bgr-grid">
    <a class="bgr-card bgr-card--housing" href="{{ '/bgr/housing/' | relative_url }}">
      <span class="bgr-card__label">Housing data</span>
      <h2>Dwelling Lens Bulgaria</h2>
      <p>
        Explore official new-dwelling price dynamics, commissioning evidence, and a curated snapshot of asking-price references for Sofia and Plovdiv.
      </p>
      <span class="bgr-card__meta">Charts · filterable tables · CSV export</span>
      <span class="bgr-card__action">Open housing dashboard <span aria-hidden="true">→</span></span>
    </a>

    <a class="bgr-card bgr-card--wine" href="{{ '/bgr/wine/' | relative_url }}">
      <span class="bgr-card__label">Wine directory</span>
      <h2>Wine Atlas Bulgaria</h2>
      <p>
        Browse a curated directory of Bulgarian wineries, wine regions, grapes, and visitor experiences through synchronized map and database views.
      </p>
      <span class="bgr-card__meta">Map · search and filters · CSV export</span>
      <span class="bgr-card__action">Open wine atlas <span aria-hidden="true">→</span></span>
    </a>

  </div>

  <p class="bgr-note">
    These tools are exploratory and preserve their source notes and methodology. Confirm mutable visitor and market information with the linked primary source.
  </p>
</div>

<style>
  .bgr-landing {
    --bgr-housing: #d96852;
    --bgr-wine: #762d43;
    padding-bottom: 1.5rem;
  }

  .bgr-intro {
    max-width: 42rem;
    margin: 0 0 2rem;
    font-size: 1.1rem;
    line-height: 1.75;
  }

  .bgr-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.25rem;
  }

  .bgr-card {
    position: relative;
    display: flex;
    min-height: 22rem;
    flex-direction: column;
    padding: 1.75rem;
    overflow: hidden;
    color: var(--global-text-color);
    background: var(--global-card-bg-color);
    border: 1px solid var(--global-divider-color);
    border-radius: 1rem;
    box-shadow: 0 0.8rem 2.5rem rgb(0 0 0 / 6%);
    transition:
      transform 180ms ease,
      border-color 180ms ease,
      box-shadow 180ms ease;
  }

  .bgr-card::before {
    position: absolute;
    inset: 0 0 auto;
    height: 0.35rem;
    content: "";
    background: var(--bgr-accent);
  }

  .bgr-card:hover,
  .bgr-card:focus-visible {
    color: var(--global-text-color);
    text-decoration: none;
    border-color: var(--bgr-accent);
    box-shadow: 0 1rem 3rem rgb(0 0 0 / 12%);
    transform: translateY(-0.2rem);
  }

  .bgr-card--housing {
    --bgr-accent: var(--bgr-housing);
  }

  .bgr-card--wine {
    --bgr-accent: var(--bgr-wine);
  }

  .bgr-card__label {
    margin-bottom: 1.25rem;
    color: var(--bgr-accent);
    font-size: 0.73rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .bgr-card h2 {
    margin: 0 0 1rem;
    font-size: clamp(1.45rem, 3vw, 2rem);
    line-height: 1.15;
  }

  .bgr-card p {
    margin-bottom: 1.5rem;
    line-height: 1.65;
  }

  .bgr-card__meta {
    margin-top: auto;
    color: var(--global-text-color-light);
    font-size: 0.82rem;
  }

  .bgr-card__action {
    margin-top: 1.25rem;
    color: var(--bgr-accent);
    font-weight: 700;
  }

  .bgr-note {
    max-width: 46rem;
    margin: 1.75rem 0 0;
    color: var(--global-text-color-light);
    font-size: 0.86rem;
    line-height: 1.6;
  }

  @media (max-width: 720px) {
    .bgr-grid {
      grid-template-columns: 1fr;
    }

    .bgr-card {
      min-height: 19rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bgr-card {
      transition: none;
    }
  }
</style>
