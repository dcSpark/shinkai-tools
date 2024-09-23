import { Tool } from '../src/index';

// Sample input JSON
const inputJson = JSON.stringify({
  answersInText: [
    {
      citation_id: 0,
      relevantTextFromDocument:
        'SpaceX is the first private company to develop a liquid-propellant rocket that has reached orbit; to launch, orbit, and recover a spacecraft; to send a spacecraft to the International Space Station; a...',
    },
    {
      citation_id: 1,
      relevantTextFromDocument:
        "It is also the first organization of any type to achieve a vertical propulsive landing of an orbital rocket booster and the first to reuse such a booster. The company's Falcon 9 rockets have landed an...",
    },
    {
      citation_id: 2,
      relevantTextFromDocument:
        'SpaceX developed its first orbital launch vehicle, the Falcon 1, with internal funding.',
    },
    {
      citation_id: 3,
      relevantTextFromDocument:
        'The Falcon 1 was an expendable two-stage-to-orbit small-lift launch vehicle.',
    },
    {
      citation_id: 4,
      relevantTextFromDocument:
        'The total development cost of Falcon 1 was approximately $90 million to $100 million.',
    },
    {
      citation_id: 5,
      relevantTextFromDocument:
        'The financial situation started to turn around with the first successful launch achieved on the fourth attempt on 28 September 2008.',
    },
    {
      citation_id: 6,
      relevantTextFromDocument:
        "The first operational Dragon spacecraft was launched in December 2010 aboard COTS Demo Flight 1, the Falcon 9's second flight, and safely returned to Earth after two orbits, completing all its mission...",
    },
    {
      citation_id: 7,
      relevantTextFromDocument:
        'In May 2012, with the Dragon C2+ launch, Dragon became the first commercial spacecraft to deliver cargo to the International Space Station.',
    },
    {
      citation_id: 8,
      relevantTextFromDocument:
        'SpaceX first achieved a successful landing and recovery of a first stage in December 2015 with Falcon 9 Flight 20.',
    },
    {
      citation_id: 9,
      relevantTextFromDocument:
        'In April 2016, the company achieved the first successful landing on the autonomous spaceport drone ship (ASDS) Of Course I Still Love You in the Atlantic Ocean.',
    },
    {
      citation_id: 10,
      relevantTextFromDocument:
        'In March 2017, SpaceX launched a returned Falcon 9 for the SES-10 satellite. This was the first time a re-launch of a payload-carrying orbital rocket went back to space.',
    },
    {
      citation_id: 11,
      relevantTextFromDocument:
        'A significant milestone was achieved in May 2020, when SpaceX successfully launched two NASA astronauts (Doug Hurley and Bob Behnken) into orbit on a Crew Dragon spacecraft during Crew Dragon Demo-2, ...',
    },
  ],
  answer: {
    introduction: {
      sentences: [
        'SpaceX has achieved several notable milestones in space exploration and technology.',
      ],
    },
    body: [
      {
        sentences: [
          'SpaceX is the first private company to develop a liquid-propellant rocket that has reached orbit; to launch, orbit, and recover a spacecraft; to send a spacecraft to the International Space Station; and to send astronauts to the International Space Station.[0]',
          'It is also the first organization of any type to achieve a vertical propulsive landing of an orbital rocket booster and the first to reuse such a booster.[1]',
          'The company currently produces and operates the Falcon 9 and Falcon Heavy rockets along with the Dragon spacecraft.[0]',
        ],
      },
      {
        sentences: [
          "The Falcon 1, developed with internal funding, was SpaceX's first orbital launch vehicle, and it was an expendable two-stage-to-orbit small-lift launch vehicle that achieved its first successful launch in 2008.[2]",
          "In December 2010, the first operational Dragon spacecraft launched aboard Falcon 9's second flight and safely returned to Earth after two orbits, completing all its mission objectives.[6]",
          'In May 2012, Dragon became the first commercial spacecraft to deliver cargo to the ISS.[7]',
        ],
      },
      {
        sentences: [
          'In December 2015, SpaceX achieved a successful landing and recovery of a first stage with Falcon 9 Flight 20, marking the first such achievement for any organization.[8]',
          'In April 2016, they achieved the first successful landing on the autonomous spaceport drone ship (ASDS) Of Course I Still Love You in the Atlantic Ocean.[9]',
          'In March 2017, SpaceX successfully launched a returned Falcon 9 for the SES-10 satellite, the first re-launch of a payload-carrying orbital rocket.[10]',
        ],
      },
      {
        sentences: [
          'A significant milestone was achieved in May 2020, when SpaceX successfully launched two NASA astronauts into orbit on a Crew Dragon spacecraft during Crew Dragon Demo-2, making them the first private company to send astronauts to the International Space Station and marking the first crewed orbital launch from American soil in 9 years.[11]',
        ],
      },
    ],
    conclusion: [
      {
        sentences: [
          "Overall, SpaceX's advancements in rocket reusability, successful commercial missions, and crewed spaceflights have solidified their position as a leader in the aerospace industry.",
        ],
      },
    ],
  },
});

// Nunjucks template
const template = `
# Introduction

{%- for sentence in answer.introduction.sentences %}
{{ sentence }}
{%- endfor %}

# Body

{%- for section in answer.body %}
## Section {{ loop.index }}

{%- for sentence in section.sentences %}
{{ sentence }}
{%- endfor %}
{%- endfor %}

# Conclusion

{%- for section in answer.conclusion %}
{{ section.sentences[0] }}
{%- endfor %}

# Citations

{%- for citation in answersInText %}
[{{ citation.citation_id }}]: {{ citation.relevantTextFromDocument }}
{%- endfor %}`;

// Expected Markdown output
const expectedMarkdown = `# Introduction
SpaceX has achieved several notable milestones in space exploration and technology.

# Body
## Section 1
SpaceX is the first private company to develop a liquid-propellant rocket that has reached orbit; to launch, orbit, and recover a spacecraft; to send a spacecraft to the International Space Station; and to send astronauts to the International Space Station.[0]
It is also the first organization of any type to achieve a vertical propulsive landing of an orbital rocket booster and the first to reuse such a booster.[1]
The company currently produces and operates the Falcon 9 and Falcon Heavy rockets along with the Dragon spacecraft.[0]
## Section 2
The Falcon 1, developed with internal funding, was SpaceX's first orbital launch vehicle, and it was an expendable two-stage-to-orbit small-lift launch vehicle that achieved its first successful launch in 2008.[2]
In December 2010, the first operational Dragon spacecraft launched aboard Falcon 9's second flight and safely returned to Earth after two orbits, completing all its mission objectives.[6]
In May 2012, Dragon became the first commercial spacecraft to deliver cargo to the ISS.[7]
## Section 3
In December 2015, SpaceX achieved a successful landing and recovery of a first stage with Falcon 9 Flight 20, marking the first such achievement for any organization.[8]
In April 2016, they achieved the first successful landing on the autonomous spaceport drone ship (ASDS) Of Course I Still Love You in the Atlantic Ocean.[9]
In March 2017, SpaceX successfully launched a returned Falcon 9 for the SES-10 satellite, the first re-launch of a payload-carrying orbital rocket.[10]
## Section 4
A significant milestone was achieved in May 2020, when SpaceX successfully launched two NASA astronauts into orbit on a Crew Dragon spacecraft during Crew Dragon Demo-2, making them the first private company to send astronauts to the International Space Station and marking the first crewed orbital launch from American soil in 9 years.[11]

# Conclusion
Overall, SpaceX's advancements in rocket reusability, successful commercial missions, and crewed spaceflights have solidified their position as a leader in the aerospace industry.

# Citations
[0]: SpaceX is the first private company to develop a liquid-propellant rocket that has reached orbit; to launch, orbit, and recover a spacecraft; to send a spacecraft to the International Space Station; a...
[1]: It is also the first organization of any type to achieve a vertical propulsive landing of an orbital rocket booster and the first to reuse such a booster. The company's Falcon 9 rockets have landed an...
[2]: SpaceX developed its first orbital launch vehicle, the Falcon 1, with internal funding.
[3]: The Falcon 1 was an expendable two-stage-to-orbit small-lift launch vehicle.
[4]: The total development cost of Falcon 1 was approximately $90 million to $100 million.
[5]: The financial situation started to turn around with the first successful launch achieved on the fourth attempt on 28 September 2008.
[6]: The first operational Dragon spacecraft was launched in December 2010 aboard COTS Demo Flight 1, the Falcon 9's second flight, and safely returned to Earth after two orbits, completing all its mission...
[7]: In May 2012, with the Dragon C2+ launch, Dragon became the first commercial spacecraft to deliver cargo to the International Space Station.
[8]: SpaceX first achieved a successful landing and recovery of a first stage in December 2015 with Falcon 9 Flight 20.
[9]: In April 2016, the company achieved the first successful landing on the autonomous spaceport drone ship (ASDS) Of Course I Still Love You in the Atlantic Ocean.
[10]: In March 2017, SpaceX launched a returned Falcon 9 for the SES-10 satellite. This was the first time a re-launch of a payload-carrying orbital rocket went back to space.
[11]: A significant milestone was achieved in May 2020, when SpaceX successfully launched two NASA astronauts (Doug Hurley and Bob Behnken) into orbit on a Crew Dragon spacecraft during Crew Dragon Demo-2, ...`;

test('exists definition', async () => {
  const tool = new Tool({
    only_system: false,
  });
  const definition = tool.getDefinition();
  expect(definition).toBeInstanceOf(Object);
});

test('Tool converts JSON to Markdown correctly', async () => {
  const tool = new Tool({
    only_system: false,
  });

  const params = {
    message: inputJson,
    template: template.trim(),
  };

  const result = await tool.run(params);
  console.log('result: ');
  console.log(result);
  expect(result).toHaveProperty('data.message');
  expect(result.data.message.trim()).toBe(expectedMarkdown.trim());
});

