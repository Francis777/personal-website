---
layout: about
title: about
permalink: /
subtitle: 🚗 + 🎹

profile:
  align: right
  image: prof_pic.jpg
  image_circular: false
  more_info:

selected_papers: false
social: true

announcements:
  enabled: false
  scrollable: false
  limit: 5

latest_posts:
  enabled: false
  scrollable: false
  limit: 3
---

<style>
  body > header {
    display: none;
  }

  body.fixed-top-nav {
    padding-top: 0;
  }

  body > .container[role="main"] {
    margin-top: 0 !important;
    padding-top: clamp(1.5rem, 4vw, 3rem);
  }

  .post > article {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(13.5rem, 30%);
    grid-template-areas:
      "main profile"
      "main social";
    column-gap: clamp(1.75rem, 5vw, 3.5rem);
    row-gap: 1.25rem;
    align-items: start;
  }

  .post > article > .clearfix {
    grid-area: main;
    min-width: 0;
    text-align: justify;
    text-justify: inter-word;
    hyphens: auto;
  }

  .post > article > .profile {
    grid-area: profile;
    float: none !important;
    width: 100%;
    margin: 0 !important;
  }

  .post > article > .profile figure {
    margin: 0;
  }

  .post > article > .social {
    grid-area: social;
    width: 100%;
    margin: 0;
  }

  .post > article > .social .contact-icons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.85rem;
    font-size: 1.8rem;
    line-height: 1;
  }

  .post > article > .social .contact-icons a {
    display: inline-flex;
  }

  .post > article > .social .contact-note {
    margin-top: 0.8rem;
  }

  .about-note-popover {
    position: relative;
    display: inline;
  }

  .about-note-trigger {
    color: inherit;
    font-family: "EB Garamond", Georgia, "Times New Roman", serif;
    padding-bottom: 0.45em;
    background-image: url("{{ '/assets/img/chalk-underline.svg' | relative_url }}");
    background-repeat: repeat-x;
    background-position: left bottom;
    background-size: 7.5rem 0.62rem;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
    text-decoration: none;
    cursor: help;
  }

  .about-note-trigger:hover,
  .about-note-trigger:focus {
    color: inherit;
    text-decoration: none;
  }

  .about-qualifier {
    color: inherit;
    font: inherit;
    opacity: 0.35;
  }

  .about-note-card {
    position: absolute;
    right: -1rem;
    bottom: calc(100% + 0.65rem);
    z-index: 100;
    width: min(22rem, calc(100vw - 2rem));
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--global-divider-color);
    border-left: 3px solid var(--global-danger-block-text);
    border-radius: 0.5rem;
    background: var(--global-bg-color);
    box-shadow: 0 0.65rem 1.75rem rgba(0, 0, 0, 0.18);
    color: var(--global-text-color);
    font-family: "EB Garamond", Georgia, "Times New Roman", serif;
    font-size: 0.86rem;
    font-style: normal;
    font-weight: 400;
    line-height: 1.5;
    text-align: left;
    opacity: 0;
    visibility: hidden;
    transform: translateY(0.35rem);
    transition:
      opacity 140ms ease,
      transform 140ms ease,
      visibility 140ms ease;
    pointer-events: none;
  }

  .about-note-card a {
    font-family: "EB Garamond", Georgia, "Times New Roman", serif;
    font-style: italic;
    font-weight: 500;
  }

  .about-note-card::after {
    position: absolute;
    top: 100%;
    right: 1rem;
    border: 0.45rem solid transparent;
    border-top-color: var(--global-bg-color);
    content: "";
  }

  .about-note-popover:hover .about-note-card,
  .about-note-popover:focus-within .about-note-card {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    pointer-events: auto;
  }

  @media (max-width: 47.99rem) {
    .post > article {
      display: flex;
      flex-direction: column;
    }

    .post > article > .profile {
      order: 1;
      max-width: 20rem;
      align-self: center;
    }

    .post > article > .social {
      order: 2;
      margin-bottom: 2rem;
    }

    .post > article > .clearfix {
      order: 3;
    }

    .about-note-card {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      left: 1rem;
      width: auto;
    }

    .about-note-card::after {
      display: none;
    }
  }
</style>

I am a researcher at [Wayve Labs](https://wayve.ai/labs/) in London, where I work on <span class="about-note-popover"><a id="wayve-note-trigger" class="about-note-trigger" href="#wayve-note-trigger" aria-label="Show an explanatory note about offline reinforcement learning at Wayve" aria-controls="wayve-note"><span style="color: var(--global-danger-block-text); font-family: 'EB Garamond', Georgia, 'Times New Roman', serif; font-weight: 600;"><span class="about-qualifier">(offline)</span> reinforcement learning</span> & <span style="color: var(--global-danger-block-text); font-family: 'EB Garamond', Georgia, 'Times New Roman', serif; font-weight: 600;">generative policies</span></a><span id="wayve-note" class="about-note-card" role="note">For a glimpse into our work on RL, see <a href="https://youtu.be/V20mxUp1NE0?si=GRcHNv7bcb9VmmYF&t=468" rel="external nofollow noopener" target="_blank">this talk</a> given by our CEO, Alex, at the <a href="https://cvpr2026.wad.vision/" rel="external nofollow noopener" target="_blank">CVPR 2026 Workshop on Autonomous Driving</a>.</span></span> for autonomous driving.

I have long been interested in <span class="about-note-popover"><a id="talks-note-trigger" class="about-note-trigger" href="#talks-note-trigger" aria-label="Show a link to selected talks" aria-controls="talks-note"><span style="color: var(--global-danger-block-text); font-family: 'EB Garamond', Georgia, 'Times New Roman', serif; font-weight: 600;">control from pixels</span></a><span id="talks-note" class="about-note-card" role="note"><a href="{% link _pages/talks.md %}">A collection of great talks</a> that have shaped my research perspective.</span></span>. While my primary focus is end-to-end autonomous driving, closing the loop between observation and action is a challenge shared across many domains. I draw inspiration from progress in other fields, from contact-rich robotic manipulation ([$\pi^\star_{0.6}$](https://www.pi.website/blog/pistar06)) to computer-use agents ([Yutori Navigator](https://yutori.com/blog/introducing-navigator)).

Before joining Wayve, I earned an M.S. in Mechanical Engineering at Stanford University, specializing in automatic control. There, I developed a strong interest in optimal control and reinforcement learning, spanning both their theoretical foundations and applications in vehicle control and finance.
