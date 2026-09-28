'use client'

import { useState } from 'react'
import Link from 'next/link'
import { uiSelectClass } from '@/lib/ui'

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-cvlt-gray-200 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-lg font-semibold text-cvlt-gray-900 transition-colors hover:text-cvlt-blue"
      >
        {title}
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm leading-relaxed text-cvlt-gray-700">{children}</div>
      )}
    </div>
  )
}


function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-cvlt-blue transition-colors hover:text-cvlt-blue-dark"
    >
      {children}
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-4.5-6H18m0 0v4.5m0-4.5L10.5 13.5" />
      </svg>
    </a>
  )
}

const hikeAndFlyRaces = [
  { date: '16.5', backup: '', name: 'MisoXperience', organizer: 'Pietro Zala (Davide Joerger)', location: 'Grono', catOpen: true, catFun: false, href: '/calendario/misoxperience' },
  { date: '30.5', backup: '31.5', name: 'Ticino X-Race', organizer: 'Matteo Monzeglio', location: 'Tesserete', catOpen: true, catFun: true, href: '/calendario/ticino-x-race', cancelled: true },
  { date: '20.6', backup: '21.6', name: 'Coppa Monte Generoso', organizer: 'TVLMG', location: 'Mendrisio', catOpen: true, catFun: true, href: '/calendario/coppa-monte-generoso' },
  { date: '19.9', backup: '20.9', name: 'Run in Fly', organizer: 'Gael Droz', location: 'Locarno', catOpen: true, catFun: true, href: '/calendario/run-in-fly-gia-belli-in-fly-2' },
  { date: '26–27.9', backup: '3–4.10', name: 'Lema Air', organizer: 'Claudio Cattaneo', location: 'Miglieglia', catOpen: true, catFun: false, href: '/calendario/lema-air' },
]

const classificaRaces = ['MisoXperience', 'Coppa M. Generoso', 'Run in Fly', 'Lema Air']

type classificaPilotEntry = { name: string; races: (number | null)[] }
const classifica2026: classificaPilotEntry[] = [
// Punti assegnati secondo le scale posto-per-posto usate dal Campionato ticinese
// di H&F (Open: 100, 85, 70, 60, 55, 50, 45, 40, 35, 30, 29, 28, poi -1 fino a 0;
// Fun: 50, 43, 35, 30, 27, 25, 22, 20, 18, 15, 14, 13, 12, 12, 10, ..., 1, poi 0),
// come pubblicato su teamvlmg.wixsite.com/handf2026. Donne e uomini sono uniti
// in un'unica classifica per categoria (Open = Extreme, Fun = Adventure).
// Ultimo aggiornamento: Run in Fly (19.9.2026).
  { name: 'Etan Studer', races: [85, 50, 0, null] },
  { name: 'Basile Marclay', races: [null, null, 100, null] },
  { name: 'Aaron Mathis', races: [100, null, null, null] },
  { name: 'Elia Sartoris', races: [null, 100, null, null] },
  { name: 'Deborah Acierno', races: [60, 28, 0, null] },
  { name: 'Michael Repond', races: [null, null, 85, null] },
  { name: 'Anton Soekeland', races: [null, 85, null, null] },
  { name: 'Nicola Heiniger', races: [null, null, 70, null] },
  { name: 'Fabian Guggisberg', races: [70, null, null, null] },
  { name: 'Tennessee Candelari', races: [null, 70, null, null] },
  { name: 'Maëlle Minnig', races: [null, null, 60, null] },
  { name: 'Pietro Zala', races: [60, null, null, null] },
  { name: 'Andrea Iati', races: [null, 60, null, null] },
  { name: 'Fabrizio Coduri', races: [null, 27, 30, null] },
  { name: 'Joël Bruchez', races: [null, null, 55, null] },
  { name: 'Stefano Tonello', races: [null, 55, null, null] },
  { name: 'Camille Van Robaeys', races: [null, null, 50, null] },
  { name: 'Lia Sutter', races: [null, null, 50, null] },
  { name: 'Renzo Zanotta', races: [null, 50, null, null] },
  { name: 'Dominik Giger', races: [null, null, 45, null] },
  { name: 'Claudia Acerbis', races: [null, 45, null, null] },
  { name: 'Diego Uccellani', races: [null, 22, 22, null] },
  { name: 'Philipp Rothenbühler', races: [null, null, 43, null] },
  { name: 'Antony Quarry', races: [null, 43, 0, null] },
  { name: 'Rafael Hunziker', races: [null, null, 40, null] },
  { name: 'Vittorio Scartazzini', races: [null, 40, null, null] },
  { name: 'Massimo Gulli', races: [null, null, 35, null] },
  { name: 'Olivier Beer', races: [null, null, 35, null] },
  { name: 'Alex Bernasconi', races: [null, 35, 0, null] },
  { name: 'Katrina Merckle', races: [null, 35, null, null] },
  { name: 'Giorgia Sugliano', races: [null, null, 30, null] },
  { name: 'Siegfried Studer', races: [null, 30, 0, null] },
  { name: 'Tamara Hobi', races: [null, 30, null, null] },
  { name: 'Brian Allaman', races: [null, null, 29, null] },
  { name: 'Jan Schmid', races: [null, 29, null, null] },
  { name: 'Fanny Bühlmann', races: [null, null, 28, null] },
  { name: 'Laurent Schwab', races: [null, null, 27, null] },
  { name: 'Matas Batutis', races: [null, null, 27, null] },
  { name: 'Marco Moor', races: [null, null, 26, null] },
  { name: 'Jonas Hofer', races: [null, null, 25, null] },
  { name: 'Matthews Pellegrini / Oxana Bätscher (PAX)', races: [null, null, 25, null] },
  { name: 'Luca Limido', races: [null, 25, null, null] },
  { name: 'Peider Stocker', races: [null, null, 24, null] },
  { name: 'Hugo Cardoso', races: [null, 12, 12, null] },
  { name: 'Samuel Mocettini', races: [null, null, 23, null] },
  { name: 'Matteo Gozzoli', races: [null, null, 22, null] },
  { name: 'Mattia Bianchini', races: [null, null, 21, null] },
  { name: 'Lorenz Barchi / Mirko (PAX)', races: [null, null, 20, null] },
  { name: 'Patrick Von Känel', races: [null, null, 20, null] },
  { name: 'Marco Marciani', races: [null, 20, null, null] },
  { name: 'Nicola Eschbach', races: [null, null, 19, null] },
  { name: 'Luca Morelli', races: [null, null, 18, null] },
  { name: 'Samira Bregy', races: [null, null, 18, null] },
  { name: 'Luca Bernaschina', races: [null, 18, null, null] },
  { name: 'Fabian Buschor', races: [null, null, 17, null] },
  { name: 'Stefano Moser', races: [null, null, 16, null] },
  { name: 'Nino Zogg', races: [null, null, 15, null] },
  { name: 'Sébastien Baumgartner', races: [null, null, 15, null] },
  { name: 'Stefano Maffioletti', races: [null, 15, null, null] },
  { name: 'Marco Zweili', races: [null, null, 14, null] },
  { name: 'Mihai Lazar', races: [null, null, 14, null] },
  { name: 'Marco Dorici', races: [null, 14, null, null] },
  { name: 'Noah Codoni', races: [null, null, 13, null] },
  { name: 'Sébastien Holvoet', races: [null, null, 13, null] },
  { name: 'Daniele Tessaro', races: [null, 13, null, null] },
  { name: 'Louis Codoni', races: [null, null, 12, null] },
  { name: 'Sean Boran', races: [null, null, 12, null] },
  { name: 'Juan Quadri', races: [null, 12, null, null] },
  { name: 'Julie Gremaud', races: [null, null, 11, null] },
  { name: 'Giovanni Soldati', races: [null, null, 10, null] },
  { name: 'Julian Kupski', races: [null, null, 10, null] },
  { name: 'Sacha Kessel', races: [null, 10, null, null] },
  { name: 'Aleksandar Bozovic', races: [null, null, 9, null] },
  { name: 'Vincent Van de Vijfeijken', races: [null, null, 9, null] },
  { name: 'Lorenzo Naso', races: [null, 9, null, null] },
  { name: 'Georg Mumenthaler', races: [null, null, 8, null] },
  { name: 'Idris Birch', races: [null, null, 8, null] },
  { name: 'Diego Bodini', races: [null, 8, null, null] },
  { name: 'Alex Del Fedele', races: [null, null, 7, null] },
  { name: 'Leda Leonardi Orso', races: [null, null, 7, null] },
  { name: 'Fabrizio Ronchetti', races: [null, 7, null, null] },
  { name: 'Damien Carrara', races: [null, null, 6, null] },
  { name: 'Marylin Prahin', races: [null, null, 6, null] },
  { name: 'Nicole Turuani', races: [null, null, 6, null] },
  { name: 'Jan Buchli', races: [null, 6, null, null] },
  { name: 'Andrea Leuthard', races: [null, null, 5, null] },
  { name: 'Julien Bucciarelli', races: [null, 5, null, null] },
  { name: 'Frederic Forny', races: [null, null, 4, null] },
  { name: 'Sylvain Simonet', races: [null, null, 4, null] },
  { name: 'Sofie Fiori', races: [null, 4, null, null] },
  { name: 'Elia Franscioni', races: [null, null, 3, null] },
  { name: 'Pietro Gioli', races: [null, null, 3, null] },
  { name: 'Giacomo Waltenspühl', races: [null, 3, null, null] },
  { name: 'Julien Doebelin Esquitino', races: [null, null, 2, null] },
  { name: 'Sandro Urban', races: [null, null, 2, null] },
  { name: 'Michele Facco', races: [null, 2, null, null] },
  { name: 'Fabrizio Bisi', races: [null, null, 1, null] },
  { name: 'Laure Zueblin', races: [null, null, 1, null] },
  { name: 'Fernando Waltenspühl', races: [null, 1, null, null] },
  { name: 'Angelo Guainazzi', races: [null, null, 0, null] },
  { name: 'Arno Gubser', races: [null, null, 0, null] },
  { name: 'Camille Girardet', races: [null, null, 0, null] },
  { name: 'Cello Bartholdi', races: [null, null, 0, null] },
  { name: 'Christof Schoch', races: [null, null, 0, null] },
  { name: 'Claudio Tanadini', races: [null, null, 0, null] },
  { name: 'Claudio Vosti', races: [null, null, 0, null] },
  { name: 'Dario Zogg', races: [null, null, 0, null] },
  { name: 'Davide Cattaneo', races: [null, null, 0, null] },
  { name: 'Enea Mellini', races: [null, null, 0, null] },
  { name: 'Eric Louvard', races: [null, null, 0, null] },
  { name: 'Fabien In-Albon', races: [null, null, 0, null] },
  { name: 'Federico Ceschi', races: [null, null, 0, null] },
  { name: 'Guillaume Ruffieux', races: [null, null, 0, null] },
  { name: 'Jamin Demenga / Lara Bini (PAX)', races: [null, null, 0, null] },
  { name: 'Jannis Lauffer', races: [null, null, 0, null] },
  { name: 'Jasmin Berton', races: [null, null, 0, null] },
  { name: 'Jasmin Wettmer', races: [null, null, 0, null] },
  { name: 'Jeanine Guajana', races: [null, null, 0, null] },
  { name: 'Jonathan Huschka', races: [null, null, 0, null] },
  { name: 'Julia Jungo', races: [null, null, 0, null] },
  { name: 'Kai Berton', races: [null, null, 0, null] },
  { name: 'Linda Costales', races: [null, null, 0, null] },
  { name: 'Loranne Berger', races: [null, null, 0, null] },
  { name: 'Marco Federspiel', races: [null, null, 0, null] },
  { name: 'Marco Fenk', races: [null, null, 0, null] },
  { name: 'Mathieu Rohner', races: [null, null, 0, null] },
  { name: 'Matteo Monzeglio', races: [null, null, 0, null] },
  { name: 'Matteo Paolocci', races: [null, 0, null, null] },
  { name: 'Maurizio Carluccio', races: [null, 0, null, null] },
  { name: 'Maël Wiget', races: [null, null, 0, null] },
  { name: 'Michaela Mooz', races: [null, null, 0, null] },
  { name: 'Miriam Preinfalk', races: [null, null, 0, null] },
  { name: 'Nadir Dazzi', races: [null, 0, null, null] },
  { name: 'Philippe Simonet', races: [null, null, 0, null] },
  { name: 'Pit Schönenberger', races: [null, null, 0, null] },
  { name: 'Riccardo Riva', races: [null, null, 0, null] },
  { name: 'Roberta Banfi', races: [null, null, 0, null] },
  { name: 'Sandrine Zweili', races: [null, null, 0, null] },
  { name: 'Sandro Gubser', races: [null, null, 0, null] },
  { name: 'Sandy Robatel', races: [null, null, 0, null] },
  { name: 'Saskia Cadisch', races: [null, null, 0, null] },
  { name: 'Selina Marti', races: [null, null, 0, null] },
  { name: 'Sijei Scolari', races: [null, null, 0, null] },
  { name: 'Simone Guglielmini', races: [null, null, 0, null] },
  { name: 'Sébastien Taracido', races: [null, null, 0, null] },
  { name: 'Timothy Phil Scandella', races: [null, null, 0, null] },
  { name: 'Tiziana Curcio', races: [null, null, 0, null] },
  { name: 'Vincent Marclay', races: [null, null, 0, null] },
  { name: 'Vincent Schaffter', races: [null, null, 0, null] },
  { name: 'Vinicio Bosshard', races: [null, null, 0, null] },
  { name: 'Yannick Voegeli', races: [null, null, 0, null] },
  { name: 'Yohan Perroud', races: [null, null, 0, null] },
]

const cccHallOfFame: { year: number; link?: string; results: { cat: string; name: string; points: string }[] }[] = [
  {
    year: 2025,
    link: 'https://www.xcontest.org/2025/ccc-cvlt/voli',
    results: [
      { cat: 'Rondini (EN-A)', name: 'Alex Pugni', points: '428.69' },
      { cat: 'Nibbi (EN-B)', name: 'Diego Verzaroli', points: '2043.97' },
      { cat: 'Aquile (EN-C)', name: 'Diego Verzaroli', points: '2043.97' },
      { cat: 'Gipeti (EN-D)', name: 'Diego Verzaroli', points: '2043.97' },
      { cat: 'Merli', name: 'Mattia Vosti', points: '111.49' },
      { cat: 'Falchi', name: 'Lorenz Barchi', points: '18.64' },
      { cat: 'Miglior donna', name: 'Jasmine Vismara (EN-B)', points: '1436.49' },
    ],
  },
  {
    year: 2024,
    link: 'https://www.xcontest.org/2024/ccc-cvlt/voli',
    results: [
      { cat: 'Rondini (EN-A)', name: 'Elia Sartoris', points: '442.29' },
      { cat: 'Nibbi (EN-B)', name: 'Diego Verzaroli', points: '1292.77' },
      { cat: 'Aquile (EN-C)', name: 'Claudio Cattaneo', points: '1501.72' },
      { cat: 'Gipeti (EN-D)', name: 'Claudio Cattaneo', points: '1501.72' },
      { cat: 'Merli', name: 'Claudio Cattaneo', points: '132.58' },
      { cat: 'Miglior donna', name: 'Jasmine Vismara (EN-B)', points: '994.97' },
    ],
  },
  {
    year: 2023,
    link: 'https://www.xcontest.org/2023/ccc-cvlt/voli',
    results: [
      { cat: 'Rondini (EN-A)', name: 'Alex Pugni', points: '230.06' },
      { cat: 'Nibbi (EN-B)', name: 'Miro Patocchi', points: '1473.52' },
      { cat: 'Aquile (EN-C)', name: 'Claudio Cattaneo', points: '1539.87' },
      { cat: 'Gipeti (EN-D)', name: 'Claudio Cattaneo', points: '1539.87' },
      { cat: 'Merli', name: 'Claudio Cattaneo', points: '102.36' },
      { cat: 'Miglior donna', name: 'Jasmine Vismara (EN-B)', points: '1022.89' },
    ],
  },
  {
    year: 2022,
    link: 'https://www.xcontest.org/2022/ccc-cvlt/voli',
    results: [
      { cat: 'Rondini (EN-A)', name: 'Etan Studer', points: '123.13' },
      { cat: 'Nibbi (EN-B)', name: 'Miro Patocchi', points: '1300.41' },
      { cat: 'Aquile (EN-C)', name: 'Claudio Cattaneo', points: '1476.81' },
      { cat: 'Gipeti (EN-D)', name: 'Claudio Cattaneo', points: '1476.81' },
      { cat: 'Merli', name: 'Claudio Cattaneo', points: '74.64' },
      { cat: 'Miglior donna', name: 'Jasmine Vismara (EN-B)', points: '1062.75' },
    ],
  },
  {
    year: 2021,
    link: 'https://www.xcontest.org/2021/ccc-cvlt/voli',
    results: [
      { cat: 'Rondini (EN-A)', name: 'Davide Jörger', points: '173.71' },
      { cat: 'Nibbi (EN-B)', name: 'Jasmine Vismara', points: '1429.56' },
      { cat: 'Aquile (EN-C)', name: 'Jasmine Vismara', points: '1429.56' },
      { cat: 'Gipeti (EN-D)', name: 'Jasmine Vismara', points: '1429.56' },
      { cat: 'Merli', name: 'Matthew Pellegrini', points: '91.06' },
    ],
  },
  {
    year: 2020,
    link: 'https://www.xcontest.org/2020/ccc-cvlt/voli',
    results: [
      { cat: 'Rondini (EN-A)', name: 'Paolo Regazzoni', points: '83.82' },
      { cat: 'Nibbi (EN-B)', name: 'Jasmine Vismara', points: '881.62' },
      { cat: 'Aquile (EN-C)', name: 'Jasmine Vismara', points: '881.62' },
      { cat: 'Gipeti (EN-D)', name: 'Jasmine Vismara', points: '881.62' },
      { cat: 'Merli', name: 'René Pfyl', points: '122.85' },
    ],
  },
  {
    year: 2019,
    link: 'https://www.xcontest.org/2019/ccc-cvlt/voli',
    results: [
      { cat: 'Rondini (EN-A)', name: 'Mattia Vosti', points: '251.58' },
      { cat: 'Nibbi (EN-B)', name: 'Jasmine Vismara', points: '1627.42' },
      { cat: 'Aquile (EN-C)', name: 'Jasmine Vismara', points: '1627.42' },
      { cat: 'Gipeti (EN-D)', name: 'Jasmine Vismara', points: '1627.42' },
      { cat: 'Merli', name: 'Michael Soland', points: '136.49' },
    ],
  },
  {
    year: 2018,
    link: 'https://www.xcontest.org/2018/ccc-cvlt/voli',
    results: [
      { cat: 'Rondini (EN-A)', name: 'Mattia Vosti', points: '255.75' },
      { cat: 'Nibbi (EN-B)', name: 'Jasmine Vismara', points: '1163.25' },
      { cat: 'Aquile (EN-C)', name: 'Jasmine Vismara', points: '1163.25' },
      { cat: 'Gipeti (EN-D)', name: 'Alex Leoni', points: '1640.41' },
      { cat: 'Merli', name: 'Matthew Pellegrini', points: '427.02' },
    ],
  },
  {
    year: 2017,
    link: 'https://www.xcontest.org/2017/ccc-cvlt/voli',
    results: [
      { cat: 'Rondini (EN-A)', name: 'Mattia Vosti', points: '81.98' },
      { cat: 'Nibbi (EN-B)', name: 'Giovanni Foletti', points: '923.74' },
      { cat: 'Aquile (EN-C)', name: 'Giovanni Foletti', points: '923.74' },
      { cat: 'Gipeti (EN-D)', name: 'Alex Leoni', points: '1964.21' },
      { cat: 'Merli', name: 'Matthew Pellegrini', points: '167.89' },
    ],
  },
  {
    year: 2016,
    results: [
      { cat: 'Rondini (EN-A)', name: 'Tamara Hobi / Enea Betté (Ex-Aequo)', points: '10' },
      { cat: 'Nibbi (EN-B)', name: 'Paolo Dova', points: '81' },
      { cat: 'Aquile (EN-C)', name: 'Paolo Dova', points: '76' },
      { cat: 'Gipeti (EN-D)', name: 'Albino Malli', points: '75' },
      { cat: 'Merli', name: 'Matthew Pellegrini', points: '38' },
    ],
  },
  {
    year: 2015,
    results: [
      { cat: 'Rondini (EN-A)', name: 'Enea Betté', points: '20' },
      { cat: 'Nibbi (EN-B)', name: 'Paolo Dova', points: '68' },
      { cat: 'Aquile (EN-C)', name: 'Marzio Ambrosetti', points: '60' },
      { cat: 'Gipeti (EN-D)', name: 'Albino Malli', points: '58' },
      { cat: 'Merli', name: 'Matteo Monzeglio / Matthew Pellegrini', points: '10' },
    ],
  },
  {
    year: 2014,
    results: [
      { cat: 'Rondini (EN-A)', name: 'Paolo Dova', points: '88' },
      { cat: 'Nibbi (EN-B)', name: 'Reto Compagnoni', points: '49' },
      { cat: 'Aquile (EN-C)', name: 'Guido Della Bruna', points: '66' },
      { cat: 'Gipeti (EN-D)', name: 'Matthew Pellegrini', points: '62' },
      { cat: 'Merli', name: 'Andrea Voumard / Luca Coda', points: '20' },
      { cat: 'Miglior donna', name: 'Tamara Hobi', points: '-' },
      { cat: 'Volo più originale', name: 'Alessandro Bisi', points: '-' },
    ],
  },
  {
    year: 2013,
    results: [
      { cat: 'Rondini (EN-A)', name: 'Guido Della Bruna', points: '80' },
      { cat: 'Nibbi (EN-B)', name: 'Matthew Pellegrini', points: '76' },
      { cat: 'Aquile (EN-C)', name: 'El Thio', points: '64' },
      { cat: 'Gipeti (EN-D)', name: 'Albino Malli', points: '62' },
      { cat: 'Miglior donna', name: 'Simi Schmid', points: '-' },
      { cat: 'Volo più originale', name: 'Biagio Lepori', points: '-' },
    ],
  },
  {
    year: 2012,
    results: [
      { cat: 'Nibbi (EN-B)', name: 'Matthew Pellegrini', points: '43' },
      { cat: 'Aquile (EN-C)', name: 'Andrea Voumard', points: '55' },
      { cat: 'Gipeti (EN-D)', name: 'Alex Pugni', points: '53' },
      { cat: 'Miglior donna', name: 'Tamara Hobi', points: '-' },
      { cat: 'Volo più originale', name: 'Boris Ozonski', points: '-' },
    ],
  },
  {
    year: 2011,
    results: [
      { cat: 'Nibbi (EN-B)', name: 'Biagio Lepori', points: '357.53' },
      { cat: 'Aquile (EN-C)', name: 'Philipp Rothenbühler', points: '259.35' },
      { cat: 'Gipeti (EN-D)', name: 'Claudio Vosti', points: '351.83' },
    ],
  },
  {
    year: 2010,
    results: [
      { cat: 'Nibbi (EN-B)', name: 'Biagio Lepori', points: '315.02' },
      { cat: 'Aquile (EN-C)', name: 'Michele Hodel', points: '404.79' },
      { cat: 'Gipeti (EN-D)', name: 'Claudio Vosti', points: '179.77' },
    ],
  },
  {
    year: 2009,
    results: [
      { cat: 'Nibbi (EN-B)', name: 'Gabi Wulz', points: '269.64' },
      { cat: 'Aquile (EN-C)', name: 'Michele Hodel', points: '364.46' },
      { cat: 'Gipeti (EN-D)', name: 'Claudio Vosti', points: '539.72' },
    ],
  },
  {
    year: 2008,
    results: [
      { cat: 'Nibbi (EN-B)', name: 'Patrick Grau', points: '293.20' },
      { cat: 'Aquile (EN-C)', name: 'Beat Grau', points: '361.36' },
      { cat: 'Gipeti (EN-D)', name: 'Manuel Croci', points: '235.39' },
    ],
  },
]

function HallOfFame() {
  const [selectedYear, setSelectedYear] = useState(cccHallOfFame[0].year)
  const entry = cccHallOfFame.find((e) => e.year === selectedYear)!

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className={`${uiSelectClass} w-auto border-cvlt-gray-200 py-1.5 font-medium shadow-sm`}
        >
          {cccHallOfFame.map((e) => (
            <option key={e.year} value={e.year}>
              {e.year}
            </option>
          ))}
        </select>
        {entry.link && (
          <ExternalLink href={entry.link}>Classifica completa</ExternalLink>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-cvlt-gray-200 text-xs font-semibold uppercase tracking-wide text-cvlt-gray-500">
              <th className="w-[40%] pb-2 pr-4">Categoria</th>
              <th className="w-[40%] pb-2 pr-4">Nome</th>
              <th className="w-[20%] pb-2 text-right">Punti</th>
            </tr>
          </thead>
          <tbody>
            {entry.results.map((r) => (
              <tr key={r.cat} className="border-b border-cvlt-gray-100 last:border-b-0">
                <td className="py-1.5 pr-4 text-cvlt-gray-500">{r.cat}</td>
                <td className="py-1.5 pr-4 font-medium text-cvlt-gray-900">{r.name}</td>
                <td className="py-1.5 text-right tabular-nums">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ClassificaTable({ title, pilots }: { title?: string; pilots: classificaPilotEntry[] }) {
  return (
    <div>
      {title ? <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-cvlt-gray-500">{title}</h4> : null}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col style={{ width: '6%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-cvlt-gray-200 text-xs font-semibold uppercase tracking-wide text-cvlt-gray-500">
              <th className="pb-2 pr-3">#</th>
              <th className="pb-2 pr-3">Pilota</th>
              {classificaRaces.map((r) => (
                <th key={r} className="pb-2 pr-3 text-center">{r}</th>
              ))}
              <th className="pb-2 text-right">Totale</th>
            </tr>
          </thead>
          <tbody>
            {pilots.map((pilot, i) => {
              const total = pilot.races.reduce<number>((sum, p) => sum + (p ?? 0), 0)
              return (
                <tr key={pilot.name} className="border-b border-cvlt-gray-100 last:border-b-0">
                  <td className="py-1.5 pr-3 text-cvlt-gray-500">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-medium text-cvlt-gray-900">{pilot.name}</td>
                  {pilot.races.map((pts, j) => (
                    <td key={j} className="py-1.5 pr-3 text-center tabular-nums text-cvlt-gray-700">
                      {pts !== null ? pts : '-'}
                    </td>
                  ))}
                  <td className="py-1.5 text-right font-semibold tabular-nums text-cvlt-gray-900">{total}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function GareContent() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-cvlt-gray-900">Gare</h1>
      <p className="mt-4 text-cvlt-gray-700">
        Le competizioni organizzate e supportate dal CVLT: il campionato Cross Country Cup (CCC)
        su XContest e il Campionato ticinese di Hike &amp; Fly.
      </p>

      {/* ── CCC ── */}
      <div id="ccc" className="mt-10">
        <h2 className="text-xl font-bold text-cvlt-gray-900">CCC &mdash; Cross Country Cup</h2>
        <p className="mt-2 text-sm text-cvlt-gray-600">
          La CCC è la competizione annuale di cross-country del CVLT, gestita tramite{' '}
          <ExternalLink href="https://www.xcontest.org/ccc-cvlt">XContest</ExternalLink>.
          I piloti soci caricano i propri voli GPS e vengono classificati automaticamente
          in base ai 10 migliori risultati della stagione.
        </p>

        <div className="mt-6 rounded-lg border border-cvlt-gray-200">
          <Section title="Regolamento" defaultOpen>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-cvlt-gray-900">Iscrizione</h4>
                <p>
                  Tramite il proprio account XContest:{' '}
                  <ExternalLink href="https://www.xcontest.org/ccc-cvlt">xcontest.org/ccc-cvlt</ExternalLink>
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-cvlt-gray-900">Periodo</h4>
                <p>
                  Dal 1° ottobre 2025 al 30 settembre 2026 (12 mesi).
                  I voli vanno caricati entro 14 giorni (standard XContest).
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-cvlt-gray-900">Partecipazione</h4>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  <li>Essere soci CVLT con quota sociale pagata</li>
                  <li>Non è necessaria la licenza sportiva FSVL</li>
                  <li>Disporre di un account su xcontest.org</li>
                  <li>Uso del GPS obbligatorio</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-cvlt-gray-900">Categorie</h4>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  <li><strong>Rondini</strong> &mdash; vele fino a EN-A</li>
                  <li><strong>Nibbi</strong> &mdash; vele fino a EN-B</li>
                  <li><strong>Aquile</strong> &mdash; vele fino a EN-C</li>
                  <li><strong>Gipeti</strong> &mdash; vele fino a EN-D</li>
                  <li><strong>Merli</strong> &mdash; parapendio tandem</li>
                  <li><strong>Falchi</strong> &mdash; delta, tutte le omologazioni</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-cvlt-gray-900">Valutazione</h4>
                <p>
                  Voli valutati secondo le regole del World XContest. Vengono considerati i
                  10 migliori voli, senza distanza minima. Il decollo deve avvenire in Ticino o Moesano.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-cvlt-gray-900">Premi</h4>
                <p>
                  Premiati i migliori di ogni categoria, con premio speciale per la miglior donna
                  e il volo più originale.
                </p>
              </div>
            </div>
          </Section>

          <Section title="Hall of Fame">
            <HallOfFame />
          </Section>
        </div>
      </div>

      {/* ── Hike & Fly ── */}
      <div id="hike-and-fly" className="mt-12">
        <h2 className="text-xl font-bold text-cvlt-gray-900">Campionato ticinese di Hike &amp; Fly</h2>
        <p className="mt-2 text-sm text-cvlt-gray-600">
          Il campionato ticinese di Hike &amp; Fly raggruppa diverse gare organizzate in Ticino e Moesano
          durante la stagione. Due categorie: <strong>Open</strong> (max 100 pt) e{' '}
          <strong>Fun</strong> (max 50 pt).
        </p>

        <div className="mt-6 rounded-lg border border-cvlt-gray-200">
          <Section title="Calendario 2026" defaultOpen>
            {/* Mobile: cards */}
            <div className="space-y-3 sm:hidden">
              {hikeAndFlyRaces.map((race) => {
                const cardContent = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className={`font-medium ${race.cancelled ? 'text-cvlt-gray-400 line-through' : 'text-cvlt-blue'}`}>{race.name}</div>
                      <div className="flex gap-1.5 whitespace-nowrap">
                        {race.cancelled && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Annullata</span>}
                        {!race.cancelled && race.catOpen && <span className="rounded bg-cvlt-blue/10 px-1.5 py-0.5 text-xs font-medium text-cvlt-blue">Open</span>}
                        {!race.cancelled && race.catFun && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">Fun</span>}
                      </div>
                    </div>
                    <div className={`mt-1 flex flex-wrap items-center gap-x-3 ${race.cancelled ? 'text-cvlt-gray-400' : 'text-cvlt-gray-600'}`}>
                      <span>{race.date}{race.backup ? ` (${race.backup})` : ''}</span>
                      <span>&middot;</span>
                      <span>{race.location}</span>
                    </div>
                    <div className={`mt-0.5 text-xs ${race.cancelled ? 'text-cvlt-gray-400' : 'text-cvlt-gray-500'}`}>{race.organizer}</div>
                  </>
                )

                if (race.cancelled) {
                  return (
                    <div key={race.name} className="rounded-lg border border-cvlt-gray-200 bg-cvlt-gray-50 p-3 text-sm opacity-70">
                      {cardContent}
                    </div>
                  )
                }

                return race.href ? (
                  <Link key={race.name} href={race.href} className="block rounded-lg border border-cvlt-gray-200 p-3 text-sm transition-colors hover:border-cvlt-blue/30 hover:bg-cvlt-blue/5">
                    {cardContent}
                  </Link>
                ) : (
                  <div key={race.name} className="rounded-lg border border-cvlt-gray-200 p-3 text-sm">
                    {cardContent}
                  </div>
                )
              })}
            </div>
            {/* Desktop: table */}
            <div className="hidden sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-cvlt-gray-200 text-xs font-semibold uppercase tracking-wide text-cvlt-gray-500">
                    <th className="pb-2 pr-3">Data</th>
                    <th className="pb-2 pr-3">Recupero</th>
                    <th className="pb-2 pr-3">Gara</th>
                    <th className="pb-2 pr-3">Organizzatore</th>
                    <th className="pb-2 pr-3">Luogo</th>
                    <th className="pb-2 pr-1 text-center">Open</th>
                    <th className="pb-2 text-center">Fun</th>
                  </tr>
                </thead>
                <tbody>
                  {hikeAndFlyRaces.map((race) => (
                    <tr key={race.name} className={`border-b border-cvlt-gray-100 last:border-b-0 ${race.cancelled ? 'opacity-50' : ''}`}>
                      <td className={`py-2 pr-3 font-medium ${race.cancelled ? 'text-cvlt-gray-400' : 'text-cvlt-gray-900'}`}>{race.date}</td>
                      <td className="py-2 pr-3 text-cvlt-gray-500">{race.backup || '-'}</td>
                      <td className="py-2 pr-3 font-medium">
                        {race.cancelled ? (
                          <span className="text-cvlt-gray-400 line-through">{race.name}</span>
                        ) : race.href ? (
                          <Link href={race.href} className="text-cvlt-blue transition-colors hover:text-cvlt-blue-dark hover:underline">
                            {race.name}
                          </Link>
                        ) : (
                          <span className="text-cvlt-blue">{race.name}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-cvlt-gray-700">{race.organizer}</td>
                      <td className="py-2 pr-3 text-cvlt-gray-700">{race.location}</td>
                      <td className="py-2 pr-1 text-center">
                        {race.cancelled ? (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Annullata</span>
                        ) : race.catOpen ? (
                          <span className="rounded bg-cvlt-blue/10 px-1.5 py-0.5 text-xs font-medium text-cvlt-blue">sì</span>
                        ) : '-'}
                      </td>
                      <td className="py-2 text-center">
                        {race.cancelled ? null : race.catFun ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">sì</span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Regolamento">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-cvlt-gray-900">Classifica</h4>
                <p>
                  Il vincitore sarà colei/colui che otterrà il miglior punteggio nelle gare in programma.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-cvlt-gray-900">Annullamenti</h4>
                <p>
                  In caso di annullamento di gare farà stato il punteggio di almeno due gare.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-cvlt-gray-900">Rinvii</h4>
                <p>
                  In caso di malaugurati ulteriori rinvii, il Comitato organizzatore CVLT/TVLMG
                  comunicherà una gara finale nel periodo invernale, stabilendo data, luogo e regolamento.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-cvlt-gray-900">Comunicazioni</h4>
                <p>
                  Ogni informazione importante inerente le gare (rinvii, annullamenti, modifiche)
                  verrà condivisa fra tutti i responsabili tramite i canali WhatsApp e chat dedicate.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-cvlt-gray-900">Risultati</h4>
                <p>
                  Al termine di ogni gara l&apos;organizzatore invierà la lista dei risultati
                  a Renzo Zanotta che aggiornerà la classifica per il CTH+F 2026,
                  pubblicata sui siti di CVLT e TVLMG.
                </p>
              </div>
            </div>
          </Section>

          <Section title="Classifica 2026">
            <ClassificaTable pilots={classifica2026} />
          </Section>
        </div>
      </div>

      {/* ── Regio Sud ── */}
      <div id="regio-sud" className="mt-12">
        <h2 className="text-xl font-bold text-cvlt-gray-900">Regio Sud (Miniliga)</h2>
        <p className="mt-2 text-sm text-cvlt-gray-600">
          La{' '}<ExternalLink href="https://www.swissleague.ch">Swiss League</ExternalLink>{' '}
          è l&apos;associazione, parte della FSVL, che si occupa dell&apos;ambito sportivo e organizza
          il campionato svizzero di parapendio.
          La <strong>Regio Sud</strong> è il gruppo regionale per il Ticino e il sud delle Alpi,
          con allenamenti e preparazione alle competizioni.
        </p>
        <p className="mt-4">
          <ExternalLink href="https://www.swissleague.ch/south">
            Regio Sud su swissleague.ch
          </ExternalLink>
        </p>
      </div>
    </main>
  )
}
