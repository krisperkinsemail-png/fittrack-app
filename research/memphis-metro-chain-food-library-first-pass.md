# Memphis Metro Chain Food Library First Pass

This file documents the first normalized restaurant batch for AI Fit.

Scope:
- Focused on chains with Memphis-area presence verified on 2026-03-27.
- Used official chain nutrition sources only.
- Normalized fields for later import: chain, item, category, serving size, calories, protein, carbs, fat, source URL, source document/date.

Included chains in this pass:
- Chick-fil-A
- Subway
- Five Guys
- Whataburger
- Dunkin'

Why these chains:
- Memphis-area locations were confirmed from official location pages or official chain location hubs.
- Public nutrition data was available in a form that exposed calories, protein, carbs, and fat without relying on third-party aggregators.

Known caveats:
- [Whataburger nutrition PDF](https://wbimageserver.whataburger.com/Nutrition.pdf) appears older than some other sources; treat it as usable but lower-confidence for freshness.
- [Subway U.S. Nutrition PDF](https://www.subway.com/-/media/USA/Documents/Nutrition/US_Nutrition_Values.pdf) is labeled November 2021, so it should be considered a stable baseline, not a guaranteed current menu snapshot.
- Five Guys publishes many items as components and customizable building blocks rather than finished burgers. In this first pass, that chain is represented with components, fries, and shake base.
- Dunkin' PDF extraction is noisy in places, so I limited entries to rows that were clearly readable in the official nutrition guide.

Current dataset status:
- Expanded beyond the initial seed list to include more breakfast sandwiches, burgers, chicken sandwiches, and Subway core sandwiches.
- Especially strong early coverage for Whataburger and Chick-fil-A, which are both highly relevant in the Memphis area.

Recommended next expansion order:
1. Wendy's
2. Taco Bell
3. Chipotle
4. McDonald's
5. KFC

Those chains have Memphis presence and should materially increase coverage for burgers, tacos, bowls, and fried chicken.
