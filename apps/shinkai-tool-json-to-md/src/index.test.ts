import { expect } from 'jsr:@std/expect/expect';
import { definition, run } from './index.ts';

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

Deno.test('exists definition', () => {
  expect(definition).toBeInstanceOf(Object);
});

Deno.test('Tool converts JSON to Markdown correctly', async () => {
  const params = {
    message: inputJson,
    template: template.trim(),
  };

  const result = await run(
    {
      only_system: false,
    },
    params,
  );
  console.log('result: ');
  console.log(result);
  expect(result).toHaveProperty('message');
  expect(result.message.trim()).toBe(expectedMarkdown.trim());
});

Deno.test('Tool converts new JSON to Markdown correctly', async () => {
  const newParams = {
    message: JSON.stringify({
      relevantSentencesFromText: [
        {
          citation_id: 5,
          document_reference: '[8] http://www.youtube.com/watch?v=eaSIq9c14YE',
          relevantSentenceFromDocument:
            'This video describes the role of light in plant growth. A comparison of light detection by human eyes and light absorption by plants begins a little bit past the halfway point.',
        },
        {
          citation_id: 0,
          document_reference:
            '[6] Arizona Master Gardener Manual, by the University of Arizona College of Agriculture’s Cooperative Extension.',
          relevantSentenceFromDocument:
            'This online book is a good example of a state-specific resource for learning about what plants need to thrive.',
        },
        {
          citation_id: 0,
          document_reference:
            '[6] Arizona Master Gardener Manual, by the University of Arizona College of Agriculture’s Cooperative Extension.',
          relevantSentenceFromDocument:
            'This online book is a good example of a state-specific resource for learning about what plants need to thrive.',
        },
        {
          citation_id: 11,
          document_reference: '[7]',
          relevantSentenceFromDocument: '',
        },
      ],
      answer: {
        brief_introduction: {
          sentences: [
            'Transplanting a houseplant can be a delicate process that requires careful consideration of the plant’s needs and the conditions provided.',
            'To ensure a successful transplant, it is essential to prepare the new pot and the soil, as well as the plant itself, in advance.',
            'As explained by [0] on the Arizona Master Gardener Manual website,[6] this preparation can help reduce stress on the plant during the transplant process.',
          ],
        },
        extensive_body: [
          {
            sentences: [
              'Firstly, as [1] describes, plants need light to grow and thrive. But different colors of light have varying effects on their development. For example, scientists on UCSB ScienceLine state that "red light is often used to boost fruit production in greenhouses, while blue light can be used to increase plant growth" [3].',
              'When transplanting a houseplant, it is essential to choose a location with the right amount of light. As [1] explains, "a comparison of light detection by human eyes and light absorption by plants begins a little bit past the halfway point." This means that even if a plant appears healthy in its current environment, it may require more or less light once moved to a new pot.',
              'In addition to ensuring the right amount of light, it is crucial to prepare the soil properly. According to [10] on Arizona Master Gardener Manual website,[6]',
              'Furthermore, plants have unique needs and preferences for optimal growth. As [1] notes that "Plants are able to sense changes in their environment using abilities similar to human sight, touch, smell, taste, and hearing." This means that even small changes can affect the plant’s overall well-being.',
              'To minimize transplant shock, gardeners should also consider the time of year when making a decision to move or transplant any plants. According to [4], it is best to do this during the spring season because this allows most species of deciduous trees and many other woody ornamental woody shrubs including fruit trees to start regrowth without major changes in weather as they usually require.',
              'In terms of optimal growth conditions, different types of plants have varying requirements when it comes to light. [2] states that "by using specialized colored filters over light lamps can produce higher plant weights" which demonstrates the fact various colors used for plants growth at high concentration affect its height length and plant biomass. Various experiments conducted, by some research studies demonstrated 1-2-fold increase of both biomass growth rate as well plant quality in comparison with an equivalent plant grown without such lighting filters.',
            ],
          },
        ],
        conclusion: [
          {
            sentences: [
              'In conclusion, transplanting a houseplant requires careful consideration of its needs and the new environment. With this information from state-specific resources like Arizona Master Gardener Manual,[6] gardeners are able to make more informed decisions about optimal growing conditions.',
              'Moreover, plants respond well-t their environment; as mentioned by Abram, "Growing Plants from Seed"[14] which further highlights various factors that should be considered when transplanting a plant.',
            ],
          },
        ],
      },
    }),
    template:
      '# Introduction{%- for sentence in answer.brief_introduction.sentences %}{{ sentence }}{%- endfor %}\\# Body{%- for section in answer.extensive_body %}## Section {{ loop.index }}{%- for sentence in section.sentences %}{{ sentence }}{%- endfor %}{%- endfor %}\\# Conclusion{%- for section in answer.conclusion %}{{ section.sentences[0] }}{%- endfor %}\\# Citations{%- for citation in relevantSentencesFromText %}[{{ citation.citation_id }}]: {{ citation.relevantSentenceFromDocument }}{%- endfor %}',
  };

  const newResult = await run(
    {
      only_system: false,
    },
    newParams,
  );
  expect(newResult).toHaveProperty('message');
  expect(newResult.message.trim()).not.toBe('');
});
