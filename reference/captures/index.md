# Reference captures of the Flash original running in Ruffle

Every PNG here was produced by `tools/ruffle/journey.cjs` (see `reference/analysis/flash-ruffle.md` for how, and for what Ruffle gets wrong). Native captures are 800 x 450 (the stage) unless the SWF's stage is another size; `@2x` files are the same moment re-rendered at 1600 x 900 (vector art redrawn at twice the size; embedded bitmaps upscaled) and are the ones worth reusing as backgrounds or art references. Text in the captures is drawn with Ruffle's fallback font, not the original Arial or Verdana (flash-ruffle.md section 4.4). The `_manifest-<mode>.json` files hold the same list with capture times, measured timings, Ruffle warnings and the AVM1 trace log.

Numbering: 001-193 main playthrough, 300-362 standalone SWFs, 400-415 levels loaded directly, 450-460 level editor, 500-510 Amy time-out variant, 600-644 kitchen game alone, x01 an extra from an earlier run of the same script.

## Main playthrough (`journey.cjs main`, Harry, `movies/e-Bug Junior Game.swf`)

| # | Capture | 2x | Description |
|---|---|---|---|
| 001 | [001-loader.png](001-loader.png) |  | Preloader at 1.0 s: black stage, red "FPS" top left, centred "Looding: junior_game_assets" / "0 %" (fallback font clips the descenders: "Loodinq") |
| 002 | [002-loader-later.png](002-loader-later.png) |  | Preloader at 2.6 s: "Looding: introductionToMicrobes_platform" (cut by the 491 px field) / "50 %" |
| 003 | [003-splash-reveal.png](003-splash-reveal.png) |  | Splash as first shown once all ten SWFs had loaded (7.5 s): the TV screen already fading from the studio to the e-Bug logo, because the animation ran while hidden during preload |
| 004 | [004-splash-mid.png](004-splash-mid.png) |  | Splash 3 s later: e-Bug logo and New Game button on the TV |
| 005 | [005-splash-new-game.png](005-splash-new-game.png) | [2x](005-splash-new-game@2x.png) | Splash final frame (sprite 58 stopped on frame 170): wooden TV on green floor, pale sky, studio behind the e-Bug logo, glossy blue New Game button; click target used (262, 263) |
| 006 | [006-cutscene-line0.png](006-cutscene-line0.png) | [2x](006-cutscene-line0@2x.png) | Cutscene: host line 0 "Hello and welcome to the e-Bug Game Show!" (typed while hidden during preload), white "next" arrow; studio with host, Amy (centre podium) and Harry (right podium), scoreboards "0000" |
| 007 | [007-cutscene-typing.png](007-cutscene-typing.png) |  | Cutscene: host line 1 "Soon you will be visiting the weird world of the microbe." (meant as a mid-typing frame; the slow run shows it complete, see x01 for a half-typed line) |
| 008 | [008-cutscene-line1.png](008-cutscene-line1.png) |  | Cutscene: host line 1 "Soon you will be visiting the weird world of the microbe." |
| 009 | [009-cutscene-line2.png](009-cutscene-line2.png) |  | Cutscene: host line 2 "But first, who do you want to play as?" |
| 010 | [010-avatar-choice.png](010-avatar-choice.png) | [2x](010-avatar-choice@2x.png) | Avatar choice frame (cutscene label choose_avatar): no talkie, host stopped, the room behind the podiums darker than during speech; invisible buttons over Amy and Harry |
| 011 | [011-avatar-hover-amy.png](011-avatar-hover-amy.png) |  | Avatar choice, pointer over Amy: Amy plays happy (hands up), Harry disappointed |
| 012 | [012-avatar-hover-harry.png](012-avatar-hover-harry.png) |  | Avatar choice, pointer over Harry: Harry plays happy (hands up, mouth open), Amy disappointed (eyes shut, pout) |
| 013 | [013-cutscene-line4.png](013-cutscene-line4.png) |  | Cutscene: host line 4 "Tell me a little about yourself:" |
| 014 | [014-details-form.png](014-details-form.png) | [2x](014-details-form@2x.png) | Details form (cutscene label get_details): blue microbe background, white labels Nickname / Age / email address, inputs pre-filled "Harry", "2", "dont@have.one", glossy Submit button |
| 015 | [015-cutscene-line8.png](015-cutscene-line8.png) |  | Cutscene: host line 8 "Allright, Lets begin by seeing what you know about microbes." |
| 016 | [016-r1-blind-intro1.png](016-r1-blind-intro1.png) | [2x](016-r1-blind-intro1@2x.png) | Round 1 blind intro line 1/4: "Welcome to the first BLIND QUESTION ROUND!" |
| 017 | [017-r1-blind-intro2.png](017-r1-blind-intro2.png) |  | Round 1 blind intro line 2/4: "I'm going to ask you some questions but I'm NOT going to tell you if you got them right!" |
| 018 | [018-r1-blind-intro3.png](018-r1-blind-intro3.png) |  | Round 1 blind intro line 3/4: "If you got them right, you'll get a great bonus later though so try your best." |
| 019 | [019-r1-blind-intro4.png](019-r1-blind-intro4.png) |  | Round 1 blind intro line 4/4 "Lets go!" (the typo is original). The first click on it changes nothing; a second click is needed (flash-ruffle.md section 6.1) |
| 020 | [020-r1-blind-q1-ask.png](020-r1-blind-q1-ask.png) |  | Round 1 blind: host "Question number 1: If you cannot see a microbe it is not there..." |
| 021 | [021-r1-blind-q1-board.png](021-r1-blind-q1-board.png) | [2x](021-r1-blind-q1-board@2x.png) | Question board: "Question 1" / "If you cannot see a microbe it is not there", "10 Points" and stopwatch top right, Agree / Don't Know / Disagree buttons; black bands left and right (board art is narrower than the stage). The script clicks Disagree (correct) |
| 022 | [022-r1-blind-q1-response.png](022-r1-blind-q1-response.png) |  | Round 1 blind: "Harry, you chose Disagree." / "Because this is a Blind question round, you'll find out how you did later." (host serious; no score change) |
| 023 | [023-r1-blind-q2-ask.png](023-r1-blind-q2-ask.png) |  | Round 1 blind: host "Question number 2: Bacteria and Viruses are the same..." |
| 024 | [024-r1-blind-q2-board.png](024-r1-blind-q2-board.png) |  | Round 1 blind: question board "Question 2" / "Bacteria and Viruses are the same" / "10 Points"; the script clicks Don't Know (SAFE answer.) |
| 025 | [025-r1-blind-q2-response.png](025-r1-blind-q2-response.png) |  | Round 1 blind: "Harry, you chose Don't Know." plus the blind notice |
| 026 | [026-r1-blind-q3-ask.png](026-r1-blind-q3-ask.png) |  | Round 1 blind: host "Question number 3: Fungi are microbes..." |
| 027 | [027-r1-blind-q3-board.png](027-r1-blind-q3-board.png) |  | Round 1 blind: question board "Question 3" / "Fungi are microbes" / "10 Points"; the script clicks Disagree (WRONG answer!) |
| 028 | [028-r1-blind-q3-response.png](028-r1-blind-q3-response.png) |  | Round 1 blind: "Harry, you chose Disagree." (wrong, but not revealed) plus the blind notice |
| 029 | [029-r1-blind-q4-ask.png](029-r1-blind-q4-ask.png) |  | Round 1 blind: host "Question number 4: Microbes are found on our hands..." |
| 030 | [030-r1-blind-q4-board.png](030-r1-blind-q4-board.png) |  | Round 1 blind: question board "Question 4" / "Microbes are found on our hands" / "10 Points"; the script clicks Agree (CORRECT answer.) |
| 031 | [031-r1-step-right.png](031-r1-step-right.png) |  | Host: "Step right this way and prepare to enter the world of microbes!" (after the last blind answer, no response line) |
| 032 | [032-r1-shrink-start.png](032-r1-shrink-start.png) |  | Shrinking zone just after the click: Harry on the red and white target under three spotlights, red and yellow shrink ray top right, radial black and white floor |
| 033 | [033-r1-shrink-mid.png](033-r1-shrink-mid.png) |  | Shrinking zone about 1.5 s in: Harry shrinking |
| 034 | [034-r1-shrink-late.png](034-r1-shrink-late.png) | [2x](034-r1-shrink-late@2x.png) | Shrinking zone about 3 s in: Harry small on the target |
| 035 | [035-level1-intro-p1.png](035-level1-intro-p1.png) | [2x](035-level1-intro-p1@2x.png) | Level 1 ePhone intro, large landscape phone: actually page 2 "With your trusty hoverboard and camera phone..." (page 1 went by during the 2x capture; page 1 is 506) |
| 036 | [036-level1-intro-p2.png](036-level1-intro-p2.png) |  | Level 1 ePhone intro: page 6 "When you are near Lucy, press the CTRL button..." with Lucy Lactobacillus (pages 3 to 5 missed; all pages are 401-406) |
| 037 | [037-level1-intro-p3.png](037-level1-intro-p3.png) |  | Level 1: the level just after the ePhone shrank (labelled as a page by the script) |
| 038 | [038-level1-opening.png](038-level1-opening.png) | [2x](038-level1-opening@2x.png) | Level 1 opening view (kitchen: pepper and salt pots, cheese, loaf, yoghurt pot on a mint counter) on the flat orange #FF9900 background; HUD: clock top centre, green score "0000" top right, three hearts, small ePhone with Lucy, camera icon and six tick boxes; red FPS counter top left |
| 039 | [039-level1-moving.png](039-level1-moving.png) |  | Level 1 after holding Right 1.5 s and tapping Up: Harry riding right on the hoverboard over the sausage, Lucy ahead |
| 040 | [040-level1-camera.png](040-level1-camera.png) |  | Level 1 after pressing CTRL (photo); the flash itself is too brief to catch at this capture rate |
| 041 | [041-level2-intro-p1.png](041-level2-intro-p1.png) |  | Level 2 ePhone intro page 2 "Photograph 3 more Lucy Lactobacillus Bacteria." (page 1 missed) |
| 042 | [042-level2-opening.png](042-level2-opening.png) | [2x](042-level2-opening@2x.png) | Level 2 opening (the hand: skin floor, a hair, plasters, Lucy, a sore) |
| 043 | [043-level2-moving.png](043-level2-moving.png) |  | Level 2: after holding Right 1.5 s and tapping Up (jump) |
| 044 | [044-level3-intro-p1.png](044-level3-intro-p1.png) |  | Level 3 ePhone intro page 1 "This time you have to photograph 3 Steve Staphylococcus" with Steve |
| 045 | [045-level3-intro-p2.png](045-level3-intro-p2.png) |  | Level 3 ePhone intro page 2 "Steve is also a bacteria like Lucy." |
| 046 | [046-level3-opening.png](046-level3-opening.png) | [2x](046-level3-opening@2x.png) | Level 3 opening (skin: dirt clump, hair, plasters) |
| 047 | [047-level3-moving.png](047-level3-moving.png) |  | Level 3: after holding Right 1.5 s and tapping Up (jump) |
| 048 | [048-level4-intro-p1.png](048-level4-intro-p1.png) |  | Level 4 ePhone intro page 1 "In this level, you need to photograph 3 Patty Penicillium" with Patty |
| 049 | [049-level4-intro-p2.png](049-level4-intro-p2.png) |  | Level 4 ePhone intro page 2 "Unlike Steve and Lucy, Patty is a FUNGUS! Fungi are bigger than bacteria." |
| 050 | [050-level4-opening.png](050-level4-opening.png) | [2x](050-level4-opening@2x.png) | Level 4 opening (kitchen again: jam jar, salt pot, cheese, Patty Penicillium) |
| 051 | [051-level4-moving.png](051-level4-moving.png) |  | Level 4: after holding Right 1.5 s and tapping Up (jump) |
| 052 | [052-r1-sighted-intro1.png](052-r1-sighted-intro1.png) |  | Round 1 sighted intro line 1/6: "Well done, you're a hoverboard natural!" |
| 053 | [053-r1-sighted-intro2.png](053-r1-sighted-intro2.png) |  | Round 1 sighted intro line 2/6: "Now it's time to ask you those questions again" |
| 054 | [054-r1-sighted-intro3.png](054-r1-sighted-intro3.png) |  | Round 1 sighted intro line 3/6: "This time, you get 10 points for a correct answer, but if you get it wrong, the other player gets points." |
| 055 | [055-r1-sighted-intro4.png](055-r1-sighted-intro4.png) |  | Round 1 sighted intro line 4/6: "so if you DON'T KNOW the answer, it's best to play it safe and say so!" |
| 056 | [056-r1-sighted-intro5.png](056-r1-sighted-intro5.png) |  | Round 1 sighted intro line 5/6: "Ready?" |
| 057 | [057-r1-sighted-intro6.png](057-r1-sighted-intro6.png) |  | Round 1 sighted intro line 6/6: "Let's go!" |
| 058 | [058-r1-sighted-q1-ask.png](058-r1-sighted-q1-ask.png) |  | Round 1 sighted: host "Question number 1: If you cannot see a microbe it is not there..." |
| 059 | [059-r1-sighted-q1-board.png](059-r1-sighted-q1-board.png) |  | Round 1 sighted: question board for question 1 again; the script clicks Disagree (correct) |
| 060 | [060-r1-sighted-q1-response.png](060-r1-sighted-q1-response.png) | [2x](060-r1-sighted-q1-response@2x.png) | Round 1 sighted: "Harry, you chose Disagree." / "This is the....CORRECT answer." (host excited, Harry happy, +10 on Harry's scoreboard) |
| 061 | [061-r1-sighted-q1-cpu.png](061-r1-sighted-q1-cpu.png) |  | CPU turn: "Amy, you chose the CORRECT answer." (Amy happy, Amy's scoreboard +10) |
| 062 | [062-r1-sighted-q2-ask.png](062-r1-sighted-q2-ask.png) |  | Round 1 sighted: host "Question number 2: Bacteria and Viruses are the same..." |
| 063 | [063-r1-sighted-q2-board.png](063-r1-sighted-q2-board.png) |  | Round 1 sighted: question board "Question 2" / "Bacteria and Viruses are the same" / "10 Points"; the script clicks Agree (WRONG answer!) |
| 064 | [064-r1-sighted-q2-response.png](064-r1-sighted-q2-response.png) |  | Round 1 sighted: "Harry, you chose Agree." / "This is the....WRONG answer!" (host and Harry disappointed; Amy gets +5) |
| 065 | [065-r1-sighted-q2-cpu.png](065-r1-sighted-q2-cpu.png) |  | CPU turn: "Amy, you chose the CORRECT answer." |
| 066 | [066-r1-sighted-q3-ask.png](066-r1-sighted-q3-ask.png) |  | Round 1 sighted: host "Question number 3: Fungi are microbes..." |
| 067 | [067-r1-sighted-q3-board.png](067-r1-sighted-q3-board.png) |  | Round 1 sighted: question board "Question 3" / "Fungi are microbes" / "10 Points"; the script clicks Don't Know (SAFE answer.) |
| 068 | [068-r1-sighted-q3-response.png](068-r1-sighted-q3-response.png) |  | Round 1 sighted: "Harry, you chose Don't Know." / "This is the....SAFE answer." (host serious, Harry neutral) |
| 069 | [069-r1-sighted-q3-cpu.png](069-r1-sighted-q3-cpu.png) |  | CPU turn: "Amy, you chose the SAFE answer." |
| 070 | [070-r1-sighted-q4-ask.png](070-r1-sighted-q4-ask.png) |  | Round 1 sighted: host "Question number 4: Microbes are found on our hands..." |
| 071 | [071-r1-sighted-q4-board.png](071-r1-sighted-q4-board.png) |  | Round 1 sighted question 4 board; after this last answer the game goes straight to round 2 with no response line |
| 072 | [072-r2-blind-intro1.png](072-r2-blind-intro1.png) |  | Round 2 blind intro line 1/4: "Welcome to the SECOND ROUND!" |
| 073 | [073-r2-blind-q1-ask.png](073-r2-blind-q1-ask.png) |  | Round 2 blind: host "Question number 1: All bacteria are harmful..." |
| 074 | [074-r2-blind-q1-board.png](074-r2-blind-q1-board.png) |  | Round 2 blind: question board "Question 1" / "All bacteria are harmful" / "10 Points"; the script clicks Disagree (CORRECT answer.) |
| 075 | [075-r2-blind-q1-response.png](075-r2-blind-q1-response.png) |  | Round 2 blind: response "<nickname>, you chose Disagree." + "Because this is a Blind question round, you'll find out how you did later." (host serious, player avatar random reaction) |
| 076 | [076-r2-shrink-mid.png](076-r2-shrink-mid.png) |  | Round 2 shrinking zone |
| 077 | [077-level5-intro-p1.png](077-level5-intro-p1.png) |  | Level 5 ePhone intro page 1 "This time, use soap to wash away Slurm Staphylococcus." |
| 078 | [078-level5-intro-p2.png](078-level5-intro-p2.png) |  | Level 5 ePhone intro page 2 "Press SPACE BAR to throw soap that you collect." |
| 079 | [079-level5-opening.png](079-level5-opening.png) | [2x](079-level5-opening@2x.png) | Level 5 opening (skin with soap pickups, dirt, hair; the ePhone shows the kill-goal picture) |
| 080 | [080-level5-moving.png](080-level5-moving.png) |  | Level 5: after holding Right 1.5 s and tapping Up (jump) |
| 081 | [081-level5-fire.png](081-level5-fire.png) |  | Level 5 after pressing SPACE (no soap collected yet, nothing thrown) |
| 082 | [082-level6-intro-p1.png](082-level6-intro-p1.png) |  | Level 6 ePhone intro page 1 "Skin has good and bad microbes on it..." |
| 083 | [083-level6-intro-p2.png](083-level6-intro-p2.png) |  | Level 6 ePhone intro page 2 "This time, use soap to wash away all the bad microbes..." |
| 084 | [084-level6-intro-p3.png](084-level6-intro-p3.png) |  | Level 6 ePhone intro page 3 "Watch out for Donna Dermatophyte though!..." |
| 085 | [085-level6-opening.png](085-level6-opening.png) | [2x](085-level6-opening@2x.png) | Level 6 opening (skin, soap pickups, a sore, Donna Dermatophyte) |
| 086 | [086-level6-moving.png](086-level6-moving.png) |  | Level 6: after holding Right 1.5 s and tapping Up (jump) |
| 087 | [087-level7-intro-p1.png](087-level7-intro-p1.png) |  | Level 7 ePhone intro page 1 "We have sent you inside the body!..." |
| 088 | [088-level7-intro-p2.png](088-level7-intro-p2.png) |  | Level 7 ePhone intro page 2 "Iggy Influenza is a flu virus..." |
| 089 | [089-level7-intro-p3.png](089-level7-intro-p3.png) |  | Level 7 ePhone intro page 3 "Bodys have natural defenses that kill intruders..." |
| 090 | [090-level7-intro-p4.png](090-level7-intro-p4.png) |  | Level 7 ePhone intro page 4 "Use the SPACE BAR to throw the body's defences at Iggy." as the phone starts to shrink |
| 091 | [091-level7-opening.png](091-level7-opening.png) | [2x](091-level7-opening@2x.png) | Level 7 opening (inside the body: red flesh floor and ceiling, villi, white blood cell pickups, Iggy Influenza) |
| 092 | [092-level7-moving.png](092-level7-moving.png) |  | Level 7: after holding Right 1.5 s and tapping Up (jump) |
| 093 | [093-level7-fire.png](093-level7-fire.png) |  | Level 7: SPACE pressed (throw soap / white blood cell if one has been picked up) |
| 094 | [094-r2-sighted-intro1.png](094-r2-sighted-intro1.png) |  | Round 2 sighted intro line 1/6 "Nice one!" |
| 095 | [095-r2-sighted-q1-ask.png](095-r2-sighted-q1-ask.png) |  | Round 2 sighted: host "Question number 1: All bacteria are harmful..." |
| 096 | [096-r2-sighted-q1-board.png](096-r2-sighted-q1-board.png) |  | Round 2 sighted: question board "Question 1" / "All bacteria are harmful" / "10 Points"; the script clicks Disagree (CORRECT answer.) |
| 097 | [097-r2-sighted-q1-response.png](097-r2-sighted-q1-response.png) |  | Round 2 sighted: "Harry, you chose Disagree." / "This is the....CORRECT answer." |
| 098 | [098-r2-sighted-q1-cpu.png](098-r2-sighted-q1-cpu.png) |  | CPU turn: "Amy, you chose the CORRECT answer." |
| 099 | [099-r3-blind-intro1.png](099-r3-blind-intro1.png) |  | Round 3 blind intro line 1/4: "Welcome to the THIRD ROUND!" |
| 100 | [100-r3-blind-q1-ask.png](100-r3-blind-q1-ask.png) |  | Round 3 blind: host "Question number 1: We use good microbes to make things like bread and yogurt..." |
| 101 | [101-r3-blind-q1-board.png](101-r3-blind-q1-board.png) |  | Round 3 blind: question board "Question 1" / "We use good microbes to make things like bread and yogurt" / "10 Points"; the script clicks Agree (CORRECT answer.) |
| 102 | [102-r3-blind-q1-response.png](102-r3-blind-q1-response.png) |  | Round 3 blind: response "<nickname>, you chose Agree." + "Because this is a Blind question round, you'll find out how you did later." (host serious, player avatar random reaction) |
| 103 | [103-r3-shrink-mid.png](103-r3-shrink-mid.png) |  | Round 3: shrinking zone about 2.5 s after the click (the chosen child on the target under the shrink ray) |
| 104 | [104-level8-intro-p1.png](104-level8-intro-p1.png) |  | Level 8 ePhone intro page 1 "We've sent you back into the kitchen..." |
| 105 | [105-level8-intro-p2.png](105-level8-intro-p2.png) |  | Level 8 ePhone intro page 2 "Lucy Lactobacillus can turn milk into yogurt..." |
| 106 | [106-level8-intro-p3.png](106-level8-intro-p3.png) |  | Level 8 ePhone intro page 3 "To turn the milk into yogurt, just push Lucy into the glass." |
| 107 | [107-level8-opening.png](107-level8-opening.png) | [2x](107-level8-opening@2x.png) | Level 8 opening (kitchen: salt pot, iced bun, sugar cube, crisps, Lucy; ePhone shows the milk goal) |
| 108 | [108-level8-moving.png](108-level8-moving.png) |  | Level 8: after holding Right 1.5 s and tapping Up (jump) |
| 109 | [109-level9-intro-p1.png](109-level9-intro-p1.png) |  | Level 9 ePhone intro page 2 "This time you have to turn THREE glasses of milk into yogurt." (page 1 missed) |
| 110 | [110-level9-intro-p2.png](110-level9-intro-p2.png) |  | Level 9: the ePhone rotating and shrinking over the level (grow/shrink animation frame) |
| 111 | [111-level9-opening.png](111-level9-opening.png) | [2x](111-level9-opening@2x.png) | Level 9 opening (kitchen: glass of milk, salt pot, toast, Lucy) |
| 112 | [112-level9-moving.png](112-level9-moving.png) |  | Level 9: after holding Right 1.5 s and tapping Up (jump) |
| 113 | [113-r3-sighted-intro1.png](113-r3-sighted-intro1.png) |  | Round 3 sighted intro line 1/6: "Yum Yogurt!" |
| 114 | [114-r3-sighted-q1-ask.png](114-r3-sighted-q1-ask.png) |  | Round 3 sighted: host "Question number 1: We use good microbes to make things like bread and yogurt..." |
| 115 | [115-r3-sighted-q1-board.png](115-r3-sighted-q1-board.png) |  | Round 3 sighted: question board "Question 1" / "We use good microbes to make things like bread and yogurt" / "10 Points"; the script clicks Agree (CORRECT answer.) |
| 116 | [116-r3-sighted-q1-response.png](116-r3-sighted-q1-response.png) |  | Round 3 sighted: "Harry, you chose Agree." / "This is the....CORRECT answer." |
| 117 | [117-r3-sighted-q1-cpu.png](117-r3-sighted-q1-cpu.png) |  | CPU turn: "Amy, you chose the WRONG answer!" (Amy disappointed; Harry +5; scoreboards Amy 0035, Harry 0080) |
| 118 | [118-r4-blind-intro1.png](118-r4-blind-intro1.png) |  | Round 4 blind intro line 1/2: "Welcome to the FOURTH  ROUND!" |
| 119 | [119-r4-blind-q1-ask.png](119-r4-blind-q1-ask.png) |  | Round 4 blind: host "Question number 1: Raw meat should go on the top shelf of the fridge...." |
| 120 | [120-r4-blind-q1-board.png](120-r4-blind-q1-board.png) |  | Round 4 blind: question board "Question 1" / "Raw meat should go on the top shelf of the fridge." / "10 Points"; the script clicks Disagree (CORRECT answer.) |
| 121 | [121-r4-blind-q1-response.png](121-r4-blind-q1-response.png) |  | Round 4 blind: response "<nickname>, you chose Disagree." + "Because this is a Blind question round, you'll find out how you did later." (host serious, player avatar random reaction) |
| 122 | [122-r4-shrink-mid.png](122-r4-shrink-mid.png) |  | Round 4 shrinking zone (next: the kitchen game instead of a platform level) |
| 123 | [123-kitchen-l0-intro1.png](123-kitchen-l0-intro1.png) | [2x](123-kitchen-l0-intro1@2x.png) | Kitchen level 0 intro screen 1: dimmed kitchen picture with Amy at the counter, white text "In this mini-game, you have to put away the shopping." / "Sounds simple, doesn't it?", blue Click button |
| 124 | [124-kitchen-l0-intro2.png](124-kitchen-l0-intro2.png) |  | Kitchen level 0 intro screen 2 "But be careful!" / "You need to put things in the right place." |
| 125 | [125-kitchen-l0-intro3.png](125-kitchen-l0-intro3.png) |  | Kitchen level 0 intro screen 3: "Here are the rules:" / vegetables in the bottom drawer / drinks and yogurt in the fridge door |
| 126 | [126-kitchen-l0-intro4.png](126-kitchen-l0-intro4.png) |  | Kitchen level 0 intro screen 4 "On the next screen, click on the correct place in the fridge to put away the spring onion." |
| 127 | [127-kitchen-l0-tutorial.png](127-kitchen-l0-tutorial.png) | [2x](127-kitchen-l0-tutorial@2x.png) | Kitchen tutorial: undimmed intro kitchen (Amy holding the spring onion), no text, no button; click the right place |
| 128 | [128-kitchen-l0-tutorial-wrong.png](128-kitchen-l0-tutorial-wrong.png) |  | Kitchen tutorial after clicking the fridge's upper shelves (wrong_button2): "Wrong!  Try again." and the two rules |
| 129 | [129-kitchen-l0-tutorial-right.png](129-kitchen-l0-tutorial-right.png) |  | Kitchen tutorial after clicking the bottom drawer: "Excellent, well done." / "Try to put away 10 things before the timer runs out." / "Click the button when you're ready to start the level..." |
| 130 | [130-kitchen-l0-play.png](130-kitchen-l0-play.png) | [2x](130-kitchen-l0-play@2x.png) | Kitchen level 0 play: the play kitchen (yellow walls, mint units, pale blue open fridge, chequered floor, bin), Harry behind the counter (always Harry here), clock top right, first item on the counter |
| 131 | [131-kitchen-l0-placing.png](131-kitchen-l0-placing.png) |  | Kitchen level 0 after three placements: the first items put away in the fridge |
| 132 | [132-kitchen-l0-done.png](132-kitchen-l0-done.png) |  | Kitchen level 0: the outro has already replaced the kitchen (all ten placed): page 1 |
| 133 | [133-kitchen-l0-outro1.png](133-kitchen-l0-outro1.png) | [2x](133-kitchen-l0-outro1@2x.png) | Kitchen outro page 1 "Shopping Placed Correctly": Vegetables X 5 = 50, Liquids X 4 = 40, the rest 0; white panel, black border, Click button |
| 134 | [134-kitchen-l0-outro2.png](134-kitchen-l0-outro2.png) |  | Kitchen outro page 2 "Items Placed Incorrectly": Liquids X 1 = - 10 (the script binned the last item on purpose) |
| 135 | [135-kitchen-l0-outro3.png](135-kitchen-l0-outro3.png) |  | Kitchen outro page 3 "Microbial Mistakes": "Liquids should be put in the fridge door." |
| 136 | [136-kitchen-l1-intro1.png](136-kitchen-l1-intro1.png) |  | Kitchen level 1 intro screen 1 "Level 2" / "This time, you also have to put away fruit, tins and bread." |
| 137 | [137-kitchen-l1-intro2.png](137-kitchen-l1-intro2.png) |  | Kitchen level 1 intro screen 2: vegetables drawer and liquids door reminders |
| 138 | [138-kitchen-l1-intro3.png](138-kitchen-l1-intro3.png) |  | Kitchen level 1 intro screen 3: "There are some new things this time." / fruit bowl / tins and bread in the cupboard |
| 139 | [139-kitchen-l1-intro4.png](139-kitchen-l1-intro4.png) |  | Kitchen level 1 intro screen 4: the sneeze and tissues warning |
| 140 | [140-kitchen-l1-play.png](140-kitchen-l1-play.png) |  | Kitchen level 1 play: first item (Soup) on the counter |
| 141 | [141-kitchen-l1-idle.png](141-kitchen-l1-idle.png) |  | Kitchen level 1 after 3 s idle (no sneeze started; see 619-620 for one) |
| 142 | [142-kitchen-l1-idle2.png](142-kitchen-l1-idle2.png) |  | Kitchen level 1 after 5.5 s idle |
| 143 | [143-kitchen-l1-tissues.png](143-kitchen-l1-tissues.png) |  | Kitchen level 1 after clicking the tissues (no sneeze running, so nothing happens) |
| 144 | [144-kitchen-l1-wash.png](144-kitchen-l1-wash.png) |  | Kitchen level 1: sink clicked, Harry washing his hands (wash_hands) |
| 145 | [145-kitchen-l1-done.png](145-kitchen-l1-done.png) |  | Kitchen level 1 at the end of the script's clicks: several items in wrong places because clicks landed while the game was not in STATE_WAIT; the level ran to its 60 s limit |
| 146 | [146-kitchen-l1-outro1.png](146-kitchen-l1-outro1.png) |  | Kitchen level 1 outro page 1: Fruit X 1 = 10, everything else 0 |
| 147 | [147-kitchen-l1-outro2.png](147-kitchen-l1-outro2.png) |  | Kitchen level 1 outro page 2: Fruit X 2 = - 20, Vegetables X 1 = - 10, Cupboard Items X 1 = - 10, Liquids X 2 = - 20 |
| 148 | [148-kitchen-l1-outro3.png](148-kitchen-l1-outro3.png) |  | Kitchen level 1 outro page 3, all four slots used: sneeze ("If you don't cover your mouth when you sneeze, you can spread harmful microbes."), liquids in the door, vegetables in the drawer, fruit in the bowl |
| 149 | [149-kitchen-l2-intro1.png](149-kitchen-l2-intro1.png) |  | Kitchen level 2 intro screen 1 "Level 3" / "Things are about to get tricky..." |
| 150 | [150-kitchen-l2-intro2.png](150-kitchen-l2-intro2.png) |  | Kitchen level 2 intro screen 2: meat must be kept away from vegetables |
| 151 | [151-kitchen-l2-intro3.png](151-kitchen-l2-intro3.png) |  | Kitchen level 2 intro screen 3: cling film, cooked meat shelf, raw meat on the bottom shelf |
| 152 | [152-kitchen-l2-intro4.png](152-kitchen-l2-intro4.png) |  | Kitchen level 2 intro screen 4: cheese on the top or middle shelf, "Ready?" |
| 153 | [153-kitchen-l2-play.png](153-kitchen-l2-play.png) |  | Kitchen level 2 play: first item (Milk) |
| 154 | [154-kitchen-l2-done.png](154-kitchen-l2-done.png) |  | Kitchen level 2 at the end of the script's clicks (partly misplaced; ran to the time limit) |
| 155 | [155-kitchen-l2-outro1.png](155-kitchen-l2-outro1.png) |  | Kitchen level 2 outro page 1: Fruit X 2 = 20, Cheese X 1 = 10, Liquids X 3 = 30 |
| 156 | [156-kitchen-l2-outro2.png](156-kitchen-l2-outro2.png) |  | Kitchen level 2 outro page 2: Vegetables, Cupboard Items and Liquids X 1 = - 10 each |
| 157 | [157-kitchen-l2-outro3.png](157-kitchen-l2-outro3.png) |  | Kitchen level 2 outro page 3: vegetables, liquids, sneeze, "Things like cans and bread should be put in the cupboard." |
| 158 | [158-kitchen-l3-intro1.png](158-kitchen-l3-intro1.png) |  | Kitchen level 3 intro screen 1 "Level 4" / "Let's see what you can do." |
| 159 | [159-kitchen-l3-intro2.png](159-kitchen-l3-intro2.png) |  | Kitchen level 3 intro screen 2 "You know all the rules now." / "Can you put away all the food correctly?" |
| 160 | [160-kitchen-l3-intro3.png](160-kitchen-l3-intro3.png) |  | Kitchen level 3 intro screen 3 "You have 45 seconds this time." / "You have to put away 20 items." / "Ready?" (the clock actually starts at 120) |
| 161 | [161-kitchen-l3-play.png](161-kitchen-l3-play.png) |  | Kitchen level 3 play: clock 120, first item (cheese); cling film overlays left from level 2 would stay in the fridge |
| 162 | [162-kitchen-l3-placing.png](162-kitchen-l3-placing.png) |  | Kitchen level 3 after 11 placements: cheese on the top shelf, cling-filmed meat on the lower shelves, items in the door and bowl |
| 163 | [163-kitchen-l3-done.png](163-kitchen-l3-done.png) |  | Kitchen level 3: all twenty placed, the outro already showing (page 1) |
| 164 | [164-kitchen-l3-outro1.png](164-kitchen-l3-outro1.png) |  | Kitchen level 3 outro page 1: Fruit 1, Vegetables 2, Cheese 3, Raw Meat 5, Cooked Meat 1, Liquids 5 (x 10 each) |
| 165 | [165-kitchen-l3-outro2.png](165-kitchen-l3-outro2.png) |  | Kitchen level 3 outro page 2: nothing placed incorrectly |
| 166 | [166-kitchen-l3-outro3.png](166-kitchen-l3-outro3.png) |  | Kitchen level 3 outro page 3: only the sneeze reminder (sneeze microbes stay on a food item across levels, flash-ruffle.md section 6.3) |
| 167 | [167-r4-sighted-intro1.png](167-r4-sighted-intro1.png) |  | Round 4 sighted intro line 1/5 "Let's see how you do on those questions again..." (after the kitchen, GameController.endOfKitchen) |
| 168 | [168-r4-sighted-q1-ask.png](168-r4-sighted-q1-ask.png) |  | Round 4 sighted: host "Question number 1: Raw meat should go on the top shelf of the fridge...." |
| 169 | [169-r4-sighted-q1-board.png](169-r4-sighted-q1-board.png) |  | Round 4 sighted: question board "Question 1" / "Raw meat should go on the top shelf of the fridge." / "10 Points"; the script clicks Disagree (CORRECT answer.) |
| 170 | [170-r4-sighted-q1-response.png](170-r4-sighted-q1-response.png) |  | Round 4 sighted: "Harry, you chose Disagree." / "This is the....CORRECT answer." |
| 171 | [171-r4-sighted-q1-cpu.png](171-r4-sighted-q1-cpu.png) |  | CPU turn: "Amy, you chose the WRONG answer!" |
| 172 | [172-r5-blind-intro1.png](172-r5-blind-intro1.png) |  | Round 5 blind intro line 1/4: "Welcome to the FINAL  ROUND!" |
| 173 | [173-r5-blind-q1-ask.png](173-r5-blind-q1-ask.png) |  | Round 5 blind: host "Question number 1: Antibiotics kill bacteria..." |
| 174 | [174-r5-blind-q1-board.png](174-r5-blind-q1-board.png) |  | Round 5 blind: question board "Question 1" / "Antibiotics kill bacteria" / "10 Points"; the script clicks Agree (CORRECT answer.) |
| 175 | [175-r5-blind-q1-response.png](175-r5-blind-q1-response.png) |  | Round 5 blind: response "<nickname>, you chose Agree." + "Because this is a Blind question round, you'll find out how you did later." (host serious, player avatar random reaction) |
| 176 | [176-r5-shrink-mid.png](176-r5-shrink-mid.png) |  | Round 5 shrinking zone |
| 177 | [177-level10-intro-p1.png](177-level10-intro-p1.png) |  | Level 10 ePhone intro page 1 "In an earlier level, you used the body's own defenses..." |
| 178 | [178-level10-intro-p2.png](178-level10-intro-p2.png) |  | Level 10 ePhone intro page 2 "Sometimes people get really sick..." with an antibiotic capsule |
| 179 | [179-level10-intro-p3.png](179-level10-intro-p3.png) |  | Level 10 ePhone intro page 3 "The most important thing when using antibiotics is to do exactly what the doctor says." |
| 180 | [180-level10-intro-p4.png](180-level10-intro-p4.png) |  | Level 10 ePhone intro page 4 "In this level you're going to use antibiotics to defeat a SUPER infection..." |
| 181 | [181-level10-intro-p5.png](181-level10-intro-p5.png) |  | Level 10 ePhone intro page 5 "You can only carry one antibiotic at a time..." |
| 182 | [182-level10-intro-p6.png](182-level10-intro-p6.png) |  | Level 10: the ePhone rotating and shrinking over the level (page 6 "Press CTRL to use the antibiotic..." missed) |
| 183 | [183-level10-opening.png](183-level10-opening.png) | [2x](183-level10-opening@2x.png) | Level 10 opening (inside the body: flesh walls, villi, antibiotic capsules; ePhone shows the super infection) |
| 184 | [184-level10-moving.png](184-level10-moving.png) |  | Level 10 after moving right: red blood cells, the super infection swarm (purple microbes), Slurm, green acid |
| 185 | [185-r5-sighted-intro1.png](185-r5-sighted-intro1.png) |  | Round 5 sighted intro line 1/6: "Not bad.  Not bad at all..." |
| 186 | [186-r5-sighted-q1-ask.png](186-r5-sighted-q1-ask.png) |  | Round 5 sighted: host "Question number 1: Antibiotics kill bacteria..." |
| 187 | [187-r5-sighted-q1-board.png](187-r5-sighted-q1-board.png) |  | Round 5 sighted: question board "Question 1" / "Antibiotics kill bacteria" / "10 Points"; the script clicks Agree (CORRECT answer.) |
| 188 | [188-r5-sighted-q1-response.png](188-r5-sighted-q1-response.png) |  | Round 5 sighted: "Harry, you chose Agree." / "This is the....CORRECT answer." |
| 189 | [189-r5-sighted-q1-cpu.png](189-r5-sighted-q1-cpu.png) |  | CPU turn: "Amy, you chose the CORRECT answer." |
| 190 | [190-final-host-line.png](190-final-host-line.png) | [2x](190-final-host-line@2x.png) | End of the game: "Well done! You beat Amy.  Thank you for playing.  To play again, reload this web page." (no winner screen) |
| 191 | [191-final-restart-1s.png](191-final-restart-1s.png) |  | After clicking the final line: nothing changes. GameShow.exit() traces "exit" and calls _root.exit(), which the main SWF never defines |
| 192 | [192-final-restart-4s.png](192-final-restart-4s.png) |  | Final line 4 s after the click (three clicks in total): unchanged |
| 193 | [193-final-restart-10s.png](193-final-restart-10s.png) |  | Final line 10 s after the click: unchanged; the game ends here |

## Variant: Amy, typed nickname, level 1 time-out (`journey.cjs timeout`)

| # | Capture | 2x | Description |
|---|---|---|---|
| 500 | [500-amy-form-typed.png](500-amy-form-typed.png) |  | Variant (Amy chosen): details form after clicking the nickname field, End, six Backspaces and typing "Sam" (Ruffle text input works) |
| 501 | [501-amy-r1-blind-intro1.png](501-amy-r1-blind-intro1.png) |  | Variant: round 1 blind intro line 1 |
| 502 | [502-amy-r1-blind-q1-response.png](502-amy-r1-blind-q1-response.png) |  | Variant: "Sam, you chose Disagree." plus the blind notice (the typed nickname is used; neither child is mid-reaction in this frame) |
| 503 | [503-amy-r1-step-right.png](503-amy-r1-step-right.png) |  | Variant: "Step right this way..." |
| 504 | [504-amy-r1-shrink-mid.png](504-amy-r1-shrink-mid.png) |  | Variant: shrinking zone with Amy on the target (the zone uses the real player's avatar) |
| 505 | [505-amy-r1-shrink-late.png](505-amy-r1-shrink-late.png) |  | Variant: Amy small on the target |
| 506 | [506-amy-level1-intro-p1.png](506-amy-level1-intro-p1.png) |  | Level 1 ePhone intro page 1 "We have shrunken you so small that you can't be seen with out a microscope!" |
| 507 | [507-amy-level1-opening.png](507-amy-level1-opening.png) |  | Level 1 opening with Amy on the hoverboard |
| 508 | [508-amy-level1-idle-60s.png](508-amy-level1-idle-60s.png) |  | Level 1 after about 60 s idle: clock 119, Amy has drifted down onto the loaf |
| 509 | [509-amy-timeout-summary.png](509-amy-timeout-summary.png) | [2x](509-amy-timeout-summary@2x.png) | Time-out: summary_page.swf over the level with a 50 % black layer (orange becomes brown): white panel, "You ran out of time." / "click to try again", Click button |
| 510 | [510-amy-after-retry.png](510-amy-after-retry.png) |  | After the summary Click: level 1 restarts from its ePhone intro; the clock still shows "-1" from the previous attempt |

## Standalone SWFs (`journey.cjs standalone`, each SWF loaded on its own; offsets are seconds after the page load)

| # | Capture | 2x | Description |
|---|---|---|---|
| 300 | [300-sa-splash-1s.png](300-sa-splash-1s.png) |  | splash.swf at 1 s: TV with a blank dark screen (reflection stripes) |
| 301 | [301-sa-splash-3s.png](301-sa-splash-3s.png) |  | splash.swf at 3 s: TV static and "Tuning" in green |
| 302 | [302-sa-splash-5s.png](302-sa-splash-5s.png) |  | splash.swf at 5 s: static, "Tuning" and five green bars |
| 303 | [303-sa-splash-6_5s.png](303-sa-splash-6_5s.png) |  | splash.swf at 6.5 s: the studio appearing on the TV |
| 304 | [304-sa-splash-9s.png](304-sa-splash-9s.png) | [2x](304-sa-splash-9s@2x.png) | splash.swf at 9 s: final frame, e-Bug logo and New Game |
| 305 | [305-sa-cutscene-introduction-2s.png](305-sa-cutscene-introduction-2s.png) |  | cutscene_introduction.swf alone at 2 s: line 0 half typed ("Hello and welco") |
| 306 | [306-sa-cutscene-introduction-6s.png](306-sa-cutscene-introduction-6s.png) | [2x](306-sa-cutscene-introduction-6s@2x.png) | cutscene_introduction.swf alone at 6 s: line 0 complete, arrow |
| 307 | [307-sa-level-intros-1s.png](307-sa-level-intros-1s.png) |  | level_intros.swf alone at 1 s: magenta #cc3366 stage, the small unscaled intro screen (host head, "We have shrunken you...") |
| 308 | [308-sa-level-intros-3s.png](308-sa-level-intros-3s.png) |  | level_intros.swf at 3 s: same page |
| 309 | [309-sa-level-intros-7s.png](309-sa-level-intros-7s.png) | [2x](309-sa-level-intros-7s@2x.png) | level_intros.swf at 7 s: page 2 (auto-advance after 5 s) |
| 310 | [310-sa-junior-game-assets-2s.png](310-sa-junior-game-assets-2s.png) | [2x](310-sa-junior-game-assets-2s@2x.png) | junior_game_assets.swf alone (800 x 600): black, nothing on its timeline (a library of exported symbols) |
| 311 | [311-sa-ebug-level-editor-3s.png](311-sa-ebug-level-editor-3s.png) |  | EBug Level Editor.swf alone (1180 x 700) at 3 s: alpha_level1.xml chosen in the file dialog and drawn (first 800 px), Left / Generate Level Code / Load / Right buttons, "Paint With e-Bug!" tile palette |
| 312 | [312-sa-ebug-level-editor-8s.png](312-sa-ebug-level-editor-8s.png) | [2x](312-sa-ebug-level-editor-8s@2x.png) | Level editor at 8 s: same |
| 313 | [313-sa-ebuggameshow-2s.png](313-sa-ebuggameshow-2s.png) |  | eBugGameShow.swf alone at 2 s: studio, talkie typing "Welcome to" |
| 314 | [314-sa-ebuggameshow-5s.png](314-sa-ebuggameshow-5s.png) | [2x](314-sa-ebuggameshow-5s@2x.png) | eBugGameShow.swf alone at 5 s: "Welcome to the first BLIND QUESTION ROUND!" complete |
| 315 | [315-sa-kitchengame-3s.png](315-sa-kitchengame-3s.png) |  | KitchenGame.swf alone at 3 s: level 0 intro screen 1 |
| 316 | [316-sa-kitchengame-6s.png](316-sa-kitchengame-6s.png) | [2x](316-sa-kitchengame-6s@2x.png) | KitchenGame.swf alone at 6 s: same |
| 317 | [317-sa-summary-page-1s.png](317-sa-summary-page-1s.png) |  | summary_page.swf alone: white panel with a black border on the olive #666600 surround (a 50 % black layer over the #cccc00 stage), "Things to remember", Click button |
| 318 | [318-sa-summary-page-3s.png](318-sa-summary-page-3s.png) |  | summary_page.swf at 3 s: Platform summary page on its own (static "Things to remember" texts) |
| 319 | [319-sa-summary-page-6s.png](319-sa-summary-page-6s.png) | [2x](319-sa-summary-page-6s@2x.png) | summary_page.swf at 6 s: Platform summary page on its own (static "Things to remember" texts) |
| 320 | [320-sa-harry-1s.png](320-sa-harry-1s.png) |  | harry.swf alone (1000 x 600, #2c2c2c): the hoverboard Harry, small at the top left (registration at 0,0) |
| 321 | [321-sa-harry-3s.png](321-sa-harry-3s.png) | [2x](321-sa-harry-3s@2x.png) | harry.swf at 3 s: Platformer Harry on the hoverboard; stage 1000x600 |
| 322 | [322-sa-amy-1s.png](322-sa-amy-1s.png) |  | amy.swf alone (550 x 400, white, letterboxed): the hoverboard Amy at the top left |
| 323 | [323-sa-amy-3s.png](323-sa-amy-3s.png) | [2x](323-sa-amy-3s@2x.png) | amy.swf at 3 s: Platformer Amy on the hoverboard; stage 550x400 shown letterboxed in 800x450 |
| 324 | [324-sa-introductiontomicrobes-mainmenu-2s.png](324-sa-introductiontomicrobes-mainmenu-2s.png) | [2x](324-sa-introductiontomicrobes-mainmenu-2s@2x.png) | introductionToMicrobes_mainMenu.swf alone: white, two small v2 component buttons "New Game" and "High Scores" (loaded by the junior game but never shown) |
| 325 | [325-sa-shrinking-harry-1s.png](325-sa-shrinking-harry-1s.png) |  | shrinking_harry.swf alone: Harry standing on white (the studio and target belong to eBugGameShow.swf, not to this SWF) |
| 326 | [326-sa-shrinking-harry-3s.png](326-sa-shrinking-harry-3s.png) | [2x](326-sa-shrinking-harry-3s@2x.png) | shrinking_harry.swf at 3 s: Shrinking zone, Harry (clip stops on frame 1 until played) |
| 327 | [327-sa-shrinking-amy-1s.png](327-sa-shrinking-amy-1s.png) |  | shrinking_amy.swf alone: Amy standing on white |
| 328 | [328-sa-shrinking-amy-3s.png](328-sa-shrinking-amy-3s.png) | [2x](328-sa-shrinking-amy-3s@2x.png) | shrinking_amy.swf at 3 s: Shrinking zone, Amy (clip stops on frame 1 until played) |
| 329 | [329-sa-kitchen-game-main-2s.png](329-sa-kitchen-game-main-2s.png) | [2x](329-sa-kitchen-game-main-2s@2x.png) | kitchen_game_main.swf alone: the play kitchen without avatar or items, clock placeholder "30" |
| 330 | [330-sa-kitchen-game-intro-level-0-2s.png](330-sa-kitchen-game-intro-level-0-2s.png) | [2x](330-sa-kitchen-game-intro-level-0-2s@2x.png) | kitchen_game_intro_level_0.swf alone: screen 1 |
| 331 | [331-sa-kitchen-game-intro-level-1-2s.png](331-sa-kitchen-game-intro-level-1-2s.png) | [2x](331-sa-kitchen-game-intro-level-1-2s@2x.png) | kitchen_game_intro_level_1.swf alone: "Level 2" screen 1 |
| 332 | [332-sa-kitchen-game-intro-level-2-2s.png](332-sa-kitchen-game-intro-level-2-2s.png) | [2x](332-sa-kitchen-game-intro-level-2-2s@2x.png) | kitchen_game_intro_level_2.swf alone: "Level 3" screen 1 |
| 333 | [333-sa-kitchen-game-intro-level-3-2s.png](333-sa-kitchen-game-intro-level-3-2s.png) | [2x](333-sa-kitchen-game-intro-level-3-2s@2x.png) | kitchen_game_intro_level_3.swf alone: "Level 4" screen 1 |
| 334 | [334-sa-kitchen-game-outro-2s.png](334-sa-kitchen-game-outro-2s.png) | [2x](334-sa-kitchen-game-outro-2s@2x.png) | kitchen_game_outro.swf alone: empty white panel on olive, Click button |
| 335 | [335-sa-talkie-2s.png](335-sa-talkie-2s.png) | [2x](335-sa-talkie-2s@2x.png) | talkie.swf alone: the talkie in its popup layout (black head box, "boya!" test text) |
| 336 | [336-sa-introductiontomicrobes-platformer-2s.png](336-sa-introductiontomicrobes-platformer-2s.png) | [2x](336-sa-introductiontomicrobes-platformer-2s@2x.png) | introductionToMicrobes_platformer.swf alone at 2 s: frame 1 placeholders (as 400) |
| 337 | [337-sa-gameover-2s.png](337-sa-gameover-2s.png) | [2x](337-sa-gameover-2s@2x.png) | gameOver.swf: black with "Game Over :-(" (not used) |
| 338 | [338-sa-game-show-2s.png](338-sa-game-show-2s.png) | [2x](338-sa-game-show-2s@2x.png) | Game_Show.swf (older build): studio with animation test buttons (Neutral Talking, Excited / Happy, Disappointed / Worried, Curious, ...) |
| 339 | [339-sa-cut-scene-director-2s.png](339-sa-cut-scene-director-2s.png) |  | cut_scene_director.swf (older cutscene): studio with the shrink ray and target combined |
| 340 | [340-sa-cut-scene-director-5s.png](340-sa-cut-scene-director-5s.png) | [2x](340-sa-cut-scene-director-5s@2x.png) | cut_scene_director.swf at 5 s: talkie waiting |
| 341 | [341-sa-dialogue-tutorial-2s.png](341-sa-dialogue-tutorial-2s.png) | [2x](341-sa-dialogue-tutorial-2s@2x.png) | dialogue_tutorial.swf: white, a speech bubble "Now... Which" |
| 342 | [342-sa-introductiontomicrobes-2s.png](342-sa-introductiontomicrobes-2s.png) | [2x](342-sa-introductiontomicrobes-2s@2x.png) | introductionToMicrobes.swf (2008 shell): black at 2 s |
| 343 | [343-sa-introductiontomicrobes-comicintroduction-2s.png](343-sa-introductiontomicrobes-comicintroduction-2s.png) | [2x](343-sa-introductiontomicrobes-comicintroduction-2s@2x.png) | introductionToMicrobes_comicIntroduction.swf: comic-style host, Amy and Harry in a playground, speech bubble |
| 344 | [344-sa-introductiontomicrobes-exitquiz-2s.png](344-sa-introductiontomicrobes-exitquiz-2s.png) | [2x](344-sa-introductiontomicrobes-exitquiz-2s@2x.png) | introductionToMicrobes_exitQuiz.swf: comic-style host and children in a classroom |
| 345 | [345-sa-avatar-harry-fridge-2s.png](345-sa-avatar-harry-fridge-2s.png) | [2x](345-sa-avatar-harry-fridge-2s@2x.png) | avatar_harry_Fridge.swf: kitchen art with Harry (older layout) |
| 346 | [346-sa-avatar-amy-fridge-2s.png](346-sa-avatar-amy-fridge-2s.png) | [2x](346-sa-avatar-amy-fridge-2s@2x.png) | avatar_amy_Fridge.swf: kitchen art with Amy, food items on the counter |
| 347 | [347-sa-fridge-game-3s.png](347-sa-fridge-game-3s.png) | [2x](347-sa-fridge-game-3s@2x.png) | fridge_game.swf (older prototype): pencil-sketch girl, table, fridge photo, "Time Left:" / "Score:" |
| 348 | [348-sa-introductiontomicrobes-platformer9-2s.png](348-sa-introductiontomicrobes-platformer9-2s.png) | [2x](348-sa-introductiontomicrobes-platformer9-2s@2x.png) | introductionToMicrobes_platformer9.swf (800 x 750): older platformer with a debug panel (Photographs, Lives, label/value rows) |
| 349 | [349-sa-introductiontomicrobes-platformer-scene-1-2s.png](349-sa-introductiontomicrobes-platformer-scene-1-2s.png) | [2x](349-sa-introductiontomicrobes-platformer-scene-1-2s@2x.png) | introductionToMicrobes_platformer_Scene 1.swf: lime #ccff66 stage, "Game Class" text |
| 350 | [350-sa-platformtest-2s.png](350-sa-platformtest-2s.png) | [2x](350-sa-platformtest-2s@2x.png) | platformTest.swf: orange stage, Harry and a rotated ePhone |
| 351 | [351-sa-map-builder-2s.png](351-sa-map-builder-2s.png) | [2x](351-sa-map-builder-2s@2x.png) | map_builder.swf (1000 x 450): white |
| 352 | [352-sa-shrinking-zone-harry-2s.png](352-sa-shrinking-zone-harry-2s.png) | [2x](352-sa-shrinking-zone-harry-2s@2x.png) | Shrinking Zone_Harry.swf: Harry standing on white (older export) |
| 353 | [353-sa-antibiotic-pickup-2s.png](353-sa-antibiotic-pickup-2s.png) | [2x](353-sa-antibiotic-pickup-2s@2x.png) | antibiotic_pickup.swf: the red and white capsule, top left |
| 354 | [354-sa-animation-test-dummy-2s.png](354-sa-animation-test-dummy-2s.png) | [2x](354-sa-animation-test-dummy-2s@2x.png) | animation_test_dummy.swf: Harry on the hoverboard with test buttons |
| 355 | [355-sa-ebug-food-sorting-game-2s.png](355-sa-ebug-food-sorting-game-2s.png) | [2x](355-sa-ebug-food-sorting-game-2s@2x.png) | ebug_food_sorting_game.swf: grey #666666, a tiny avatar top left |
| 356 | [356-sa-microbes-motions-colin-motion-2s.png](356-sa-microbes-motions-colin-motion-2s.png) | [2x](356-sa-microbes-motions-colin-motion-2s@2x.png) | Colin_motion.swf (1000 x 600): Colin, small, on #2c2c2c |
| 357 | [357-sa-microbes-motions-donna-motion-2s.png](357-sa-microbes-motions-donna-motion-2s.png) | [2x](357-sa-microbes-motions-donna-motion-2s@2x.png) | Donna_motion.swf: Donna Dermatophyte, small |
| 358 | [358-sa-microbes-motions-steve-motion-2s.png](358-sa-microbes-motions-steve-motion-2s.png) | [2x](358-sa-microbes-motions-steve-motion-2s@2x.png) | Steve_motion.swf: Steve Staphylococcus, small |
| 359 | [359-sa-sandy-art-liquid-soap-2s.png](359-sa-sandy-art-liquid-soap-2s.png) | [2x](359-sa-sandy-art-liquid-soap-2s@2x.png) | Liquid Soap.swf: the blue soap pickup |
| 360 | [360-sa-sandy-art-white-blood-cell-pick-up-2s.png](360-sa-sandy-art-white-blood-cell-pick-up-2s.png) | [2x](360-sa-sandy-art-white-blood-cell-pick-up-2s@2x.png) | White Blood Cell Pick Up.swf at its native 49 x 49: the white blood cell pickup |
| 361 | [361-sa-sandy-art-white-blood-cell-projectile-2s.png](361-sa-sandy-art-white-blood-cell-projectile-2s.png) | [2x](361-sa-sandy-art-white-blood-cell-projectile-2s@2x.png) | White Blood Cell Projectile.swf: two small projectile frames on white |
| 362 | [362-sa-sandy-art-milk-2s.png](362-sa-sandy-art-milk-2s.png) | [2x](362-sa-sandy-art-milk-2s@2x.png) | milk.swf at its native 150 x 200: the milk glass (frame of a 20-frame clip) |

## Level editor views (`journey.cjs editor`, `movies/EBug Level Editor.swf` with each level chosen through `FileReference.browse`)

| # | Capture | 2x | Description |
|---|---|---|---|
| 450 | [450-editor-alpha_level1.png](450-editor-alpha_level1.png) | [2x](450-editor-alpha_level1@2x.png) | Level editor, alpha_level1.xml: first 800 px of the level as the editor draws it (beige background, the editor's own tile copies), tile palette bottom left |
| 451 | [451-editor-alpha_level2.png](451-editor-alpha_level2.png) |  | Level editor, alpha_level2.xml: first 800 px of the level as the editor draws it (beige background, the editor's own tile copies), tile palette bottom left |
| 452 | [452-editor-alpha_level3.png](452-editor-alpha_level3.png) |  | Level editor, alpha_level3.xml: first 800 px of the level as the editor draws it (beige background, the editor's own tile copies), tile palette bottom left |
| 453 | [453-editor-alpha_level4.png](453-editor-alpha_level4.png) |  | Level editor, alpha_level4.xml: first 800 px of the level as the editor draws it (beige background, the editor's own tile copies), tile palette bottom left |
| 454 | [454-editor-alpha_level5.png](454-editor-alpha_level5.png) |  | Level editor, alpha_level5.xml: first 800 px of the level as the editor draws it (beige background, the editor's own tile copies), tile palette bottom left |
| 455 | [455-editor-alpha_level6.png](455-editor-alpha_level6.png) |  | Level editor, alpha_level6.xml: first 800 px of the level as the editor draws it (beige background, the editor's own tile copies), tile palette bottom left |
| 456 | [456-editor-alpha_level7.png](456-editor-alpha_level7.png) |  | Level editor, alpha_level7.xml: first 800 px of the level as the editor draws it (beige background, the editor's own tile copies), tile palette bottom left |
| 457 | [457-editor-alpha_level8.png](457-editor-alpha_level8.png) |  | Level editor, alpha_level8.xml: first 800 px of the level as the editor draws it (beige background, the editor's own tile copies), tile palette bottom left |
| 458 | [458-editor-alpha_level9.png](458-editor-alpha_level9.png) |  | Level editor, alpha_level9.xml: first 800 px of the level as the editor draws it (beige background, the editor's own tile copies), tile palette bottom left |
| 459 | [459-editor-alpha_level10.png](459-editor-alpha_level10.png) |  | Level editor, alpha_level10.xml: first 800 px of the level as the editor draws it (beige background, the editor's own tile copies), tile palette bottom left |
| 460 | [460-editor-alpha_level11.png](460-editor-alpha_level11.png) |  | Level editor, alpha_level11.xml: first 800 px of the level as the editor draws it (beige background, the editor's own tile copies), tile palette bottom left |

## Levels loaded directly (`journey.cjs level`, platformer alone plus context-menu Play)

| # | Capture | 2x | Description |
|---|---|---|---|
| 400 | [400-lv-alpha_level1-frame1.png](400-lv-alpha_level1-frame1.png) |  | Platformer SWF on its own (flashvar level=alpha_level1.xml), root frame 1: orange background, yellow and brown placeholder boxes, clock "90", score, hearts and the small ePhone; stopped |
| 401 | [401-lv-alpha_level1-intro-p1.png](401-lv-alpha_level1-intro-p1.png) |  | Platformer alone, level 1 ePhone intro page 2 "With your trusty hoverboard and camera phone..." |
| 402 | [402-lv-alpha_level1-intro-p2.png](402-lv-alpha_level1-intro-p2.png) |  | Platformer alone, level 1 ePhone intro page 3 "Microbes are everywhere, including the kitchen..." |
| 403 | [403-lv-alpha_level1-intro-p3.png](403-lv-alpha_level1-intro-p3.png) |  | Platformer alone, level 1 ePhone intro page 4 "Your mission is to photograph 3 Lucy Lactobacillus." (camera icon) |
| 404 | [404-lv-alpha_level1-intro-p4.png](404-lv-alpha_level1-intro-p4.png) |  | Platformer alone, level 1 ePhone intro page 5 "Lucy is a bacteria." with Lucy Lactobacillus |
| 405 | [405-lv-alpha_level1-intro-p5.png](405-lv-alpha_level1-intro-p5.png) |  | Platformer alone, level 1 ePhone intro page 6 "When you are near Lucy, press the CTRL button..." |
| 406 | [406-lv-alpha_level1-intro-p6.png](406-lv-alpha_level1-intro-p6.png) |  | Platformer alone, level 1 ePhone intro page 7 "When you have taken all the photos, find the PORTAL to go to level 2." (portal) |
| 407 | [407-lv-alpha_level1-opening.png](407-lv-alpha_level1-opening.png) |  | Platformer alone, level 1 opening view (same as 038, loaded without the game controller) |
| 408 | [408-lv-alpha_level11-frame1.png](408-lv-alpha_level11-frame1.png) |  | Platformer alone with level=alpha_level11.xml, root frame 1 |
| 409 | [409-lv-alpha_level11-intro-p1.png](409-lv-alpha_level11-intro-p1.png) | [2x](409-lv-alpha_level11-intro-p1@2x.png) | alpha_level11 intro: the level 1 pages (no level11 label); this is page 2 |
| 410 | [410-lv-alpha_level11-intro-p2.png](410-lv-alpha_level11-intro-p2.png) |  | alpha_level11 intro: level 1 page 4 |
| 411 | [411-lv-alpha_level11-intro-p3.png](411-lv-alpha_level11-intro-p3.png) |  | alpha_level11 intro: level 1 page 5 |
| 412 | [412-lv-alpha_level11-intro-p4.png](412-lv-alpha_level11-intro-p4.png) |  | alpha_level11 intro: level 1 page 6 |
| 413 | [413-lv-alpha_level11-intro-p5.png](413-lv-alpha_level11-intro-p5.png) |  | alpha_level11 intro: level 1 page 7 |
| 414 | [414-lv-alpha_level11-intro-p6.png](414-lv-alpha_level11-intro-p6.png) |  | alpha_level11: the level as the phone shrinks |
| 415 | [415-lv-alpha_level11-opening.png](415-lv-alpha_level11-opening.png) | [2x](415-lv-alpha_level11-opening@2x.png) | alpha_level11 (in no chain) opening view: body level with red blood cells, white blood cells, antibiotic capsules and a flesh floor; ePhone shows the super infection goal |

## Kitchen game on its own (`journey.cjs kitchen`, `movies/KitchenGame.swf` alone, all four levels played; runs at full speed, so every placement registered)

| # | Capture | 2x | Description |
|---|---|---|---|
| 600 | [600-kitchen-l0-intro1.png](600-kitchen-l0-intro1.png) | [2x](600-kitchen-l0-intro1@2x.png) | Kitchen level 0 intro screen 1 (dimmed kitchen, white text, blue Click button) |
| 601 | [601-kitchen-l0-intro2.png](601-kitchen-l0-intro2.png) |  | Kitchen level 0 intro screen 2 (dimmed kitchen, white text, blue Click button) |
| 602 | [602-kitchen-l0-intro3.png](602-kitchen-l0-intro3.png) |  | Kitchen level 0 intro screen 3 (dimmed kitchen, white text, blue Click button) |
| 603 | [603-kitchen-l0-intro4.png](603-kitchen-l0-intro4.png) |  | Kitchen level 0 intro screen 4 (dimmed kitchen, white text, blue Click button) |
| 604 | [604-kitchen-l0-tutorial.png](604-kitchen-l0-tutorial.png) | [2x](604-kitchen-l0-tutorial@2x.png) | Kitchen level 0 tutorial: undimmed kitchen, click where the spring onion goes |
| 605 | [605-kitchen-l0-tutorial-wrong.png](605-kitchen-l0-tutorial-wrong.png) |  | Kitchen tutorial after a wrong place: "Wrong!  Try again." with the two rules |
| 606 | [606-kitchen-l0-tutorial-right.png](606-kitchen-l0-tutorial-right.png) |  | Kitchen tutorial after the drawer: "Excellent, well done." / "Try to put away 10 things before the timer runs out." |
| 607 | [607-kitchen-l0-play.png](607-kitchen-l0-play.png) | [2x](607-kitchen-l0-play@2x.png) | Kitchen level 0 play: first item (Broccoli) on the counter, clock top right |
| 608 | [608-kitchen-l0-placing.png](608-kitchen-l0-placing.png) |  | Kitchen level 0 after 3 placements (avatar animation for the last location, items in the fridge/bowl/cupboard) |
| 609 | [609-kitchen-l0-done.png](609-kitchen-l0-done.png) |  | Kitchen level 0: every item placed (level ends at the next one-second tick) |
| 610 | [610-kitchen-l0-outro1.png](610-kitchen-l0-outro1.png) | [2x](610-kitchen-l0-outro1@2x.png) | Kitchen level 0 outro page 1: "Shopping Placed Correctly" rows with x10 sums |
| 611 | [611-kitchen-l0-outro2.png](611-kitchen-l0-outro2.png) |  | Kitchen level 0 outro page 2: "Items Placed Incorrectly" rows |
| 612 | [612-kitchen-l0-outro3.png](612-kitchen-l0-outro3.png) |  | Kitchen level 0 outro page 3: "Microbial Mistakes" admonishments (4 slots) |
| 613 | [613-kitchen-l1-intro1.png](613-kitchen-l1-intro1.png) |  | Kitchen level 1 intro screen 1 (dimmed kitchen, white text, blue Click button) |
| 614 | [614-kitchen-l1-intro2.png](614-kitchen-l1-intro2.png) |  | Kitchen level 1 intro screen 2 (dimmed kitchen, white text, blue Click button) |
| 615 | [615-kitchen-l1-intro3.png](615-kitchen-l1-intro3.png) |  | Kitchen level 1 intro screen 3 (dimmed kitchen, white text, blue Click button) |
| 616 | [616-kitchen-l1-intro4.png](616-kitchen-l1-intro4.png) |  | Kitchen level 1 intro screen 4 (dimmed kitchen, white text, blue Click button) |
| 617 | [617-kitchen-l1-play.png](617-kitchen-l1-play.png) |  | Kitchen level 1 play: first item (Carrots) on the counter, clock top right |
| 618 | [618-kitchen-l1-idle.png](618-kitchen-l1-idle.png) |  | KitchenGame.swf alone, level 1 after 3 s idle |
| 619 | [619-kitchen-l1-idle2.png](619-kitchen-l1-idle2.png) |  | Level 1 after 5.5 s idle: a sneeze has started (Harry, sneeze_Start / sneeze_mid) |
| 620 | [620-kitchen-l1-tissues.png](620-kitchen-l1-tissues.png) |  | Level 1 after clicking the tissues during the sneeze: Harry sneezes into a tissue (sneeze_tissue_end) |
| 621 | [621-kitchen-l1-wash.png](621-kitchen-l1-wash.png) |  | Level 1: sink clicked, wash_hands |
| 622 | [622-kitchen-l1-done.png](622-kitchen-l1-done.png) |  | Level 1 finished early (all ten placed), outro page 1 already showing |
| 623 | [623-kitchen-l1-outro1.png](623-kitchen-l1-outro1.png) |  | Level 1 outro page 1: Fruit 1, Vegetables 4, Cupboard Items 1, Liquids 3 |
| 624 | [624-kitchen-l1-outro2.png](624-kitchen-l1-outro2.png) |  | Level 1 outro page 2: nothing incorrect |
| 625 | [625-kitchen-l1-outro3.png](625-kitchen-l1-outro3.png) |  | Level 1 outro page 3: the sneeze reminder only |
| 626 | [626-kitchen-l2-intro1.png](626-kitchen-l2-intro1.png) |  | Kitchen level 2 intro screen 1 (dimmed kitchen, white text, blue Click button) |
| 627 | [627-kitchen-l2-intro2.png](627-kitchen-l2-intro2.png) |  | Kitchen level 2 intro screen 2 (dimmed kitchen, white text, blue Click button) |
| 628 | [628-kitchen-l2-intro3.png](628-kitchen-l2-intro3.png) |  | Kitchen level 2 intro screen 3 (dimmed kitchen, white text, blue Click button) |
| 629 | [629-kitchen-l2-intro4.png](629-kitchen-l2-intro4.png) |  | Kitchen level 2 intro screen 4 (dimmed kitchen, white text, blue Click button) |
| 630 | [630-kitchen-l2-play.png](630-kitchen-l2-play.png) |  | Kitchen level 2 play: first item (Bread) on the counter, clock top right |
| 631 | [631-kitchen-l2-clingfilm.png](631-kitchen-l2-clingfilm.png) |  | Level 2: cling film applied to the item on the counter |
| 632 | [632-kitchen-l2-done.png](632-kitchen-l2-done.png) |  | Kitchen level 2: every item placed (level ends at the next one-second tick) |
| 633 | [633-kitchen-l2-outro1.png](633-kitchen-l2-outro1.png) |  | Level 2 outro page 1: Cupboard Items 2, Raw Meat 4, Cooked Meat 2, Liquids 1; the first Raw Sausages, placed without cling film on purpose, still counts as correct because its twin later in the list was cling-filmed (both are the same FoodItem object) |
| 634 | [634-kitchen-l2-outro2.png](634-kitchen-l2-outro2.png) |  | Level 2 outro page 2: nothing incorrect |
| 635 | [635-kitchen-l2-outro3.png](635-kitchen-l2-outro3.png) |  | Level 2 outro page 3: sneeze reminder (carried over on a food object from level 1) |
| 636 | [636-kitchen-l3-intro1.png](636-kitchen-l3-intro1.png) |  | Kitchen level 3 intro screen 1 (dimmed kitchen, white text, blue Click button) |
| 637 | [637-kitchen-l3-intro2.png](637-kitchen-l3-intro2.png) |  | Kitchen level 3 intro screen 2 (dimmed kitchen, white text, blue Click button) |
| 638 | [638-kitchen-l3-intro3.png](638-kitchen-l3-intro3.png) |  | Kitchen level 3 intro screen 3 (dimmed kitchen, white text, blue Click button) |
| 639 | [639-kitchen-l3-play.png](639-kitchen-l3-play.png) |  | Kitchen level 3 play: first item (Milk) on the counter, clock top right |
| 640 | [640-kitchen-l3-placing.png](640-kitchen-l3-placing.png) |  | Kitchen level 3 after 11 placements (avatar animation for the last location, items in the fridge/bowl/cupboard) |
| 641 | [641-kitchen-l3-done.png](641-kitchen-l3-done.png) |  | Kitchen level 3: every item placed (level ends at the next one-second tick) |
| 642 | [642-kitchen-l3-outro1.png](642-kitchen-l3-outro1.png) |  | Level 3 outro page 1: Fruit 1, Vegetables 1, Cupboard 1, Cheese 1, Raw Meat 5, Cooked Meat 4, Liquids 5 |
| 643 | [643-kitchen-l3-outro2.png](643-kitchen-l3-outro2.png) |  | Level 3 outro page 2: nothing incorrect |
| 644 | [644-kitchen-l3-outro3.png](644-kitchen-l3-outro3.png) |  | Level 3 outro page 3: sneeze reminder |

## Extras

| # | Capture | 2x | Description |
|---|---|---|---|
| x01 | [x01-talkie-arrow-while-typing.png](x01-talkie-arrow-while-typing.png) | | From an earlier run (same script): round 1 blind response half typed ("...you'll find ou") with the white "next" arrow already showing (flash-ruffle.md section 6.2) |

## Other files in this folder (not made by journey.cjs)

- [platformer-standalone-frame1.png](platformer-standalone-frame1.png): not produced by journey.cjs (added by another task working in this folder)
- [port-level1-portal-closed-cam2550.png](port-level1-portal-closed-cam2550.png): not produced by journey.cjs (added by another task working in this folder)
- [ruffle-level1-intro-page2.png](ruffle-level1-intro-page2.png): not produced by journey.cjs (added by another task working in this folder)
- [ruffle-level1-opening.png](ruffle-level1-opening.png): not produced by journey.cjs (added by another task working in this folder)
- [ruffle-level1-photo-riding-right.png](ruffle-level1-photo-riding-right.png): not produced by journey.cjs (added by another task working in this folder)
- [ruffle-level1-photo-standing.png](ruffle-level1-photo-standing.png): not produced by journey.cjs (added by another task working in this folder)
- [ruffle-level1-portal-closed-tile-over-portal.png](ruffle-level1-portal-closed-tile-over-portal.png): not produced by journey.cjs (added by another task working in this folder)

Total: 340 native captures, 78 of them with a 2x version.
