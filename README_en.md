# CI Sound Balancing Tool

This tool helps users of cochlear implants measure their perceived loudness and pitch.
- Based on the measurement results, audio files can be played back with a simulated fitting.
- Once it sounds good to you, you can print an overview of the requested changes for your audiologist.

You can find the tool here, it runs online in your browser: [CI Sound Balancing Tool](https://mviereck.github.io/ci-sound-balancing/)

You can also use the tool offline. [Download as ZIP file](https://github.com/mviereck/ci-sound-balancing/archive/refs/heads/main.zip). After unpacking, the tool opens in your browser by double-clicking *index.html*.

The tool supports devices of all three major manufacturers: MED-EL, Cochlear and Advanced Bionics.

## Background

The goal is that all electrodes sound equally loud ("loudness balancing"), and that pitches on the left and right are perceived as equally high or low.

This balancing of electrode loudness (per CI) and pitch (left/right) is the foundation for comfortable and as natural as possible hearing.

Audiologists usually do not have enough time to perform these measurements with the necessary thoroughness. This is where the tool helps: you can carry out the measurements on your own at home, with no time pressure.

Based on these self-measured data, the integrated audio player can play back a simulated fitting. This allows you to assess in advance what sounds best for you.

In addition to plain loudness and pitch balancing, you can apply semi-automatic adjustments to improve speech intelligibility, or e.g. boost bass or treble. You can hear the effect of your adjustments live by simultaneously playing music or an audiobook in the audio player.

Once you have found a fitting that you like, you can print out the necessary changes and give them to your audiologist.

## Limitation

The tool works exclusively with acoustic signals. Acoustic signals may also activate neighbouring electrodes. This makes the measurement somewhat imprecise. Direct stimulation of individual electrodes would be ideal, but that option remains with the audiologist only.

## Important recommendation: test program without filters

To assess the loudness of each individual electrode as unaltered as possible, all automatic sound-processing filters in the CI processor should be disabled. Ask your audiologist to set up an additional test program for you.

You can use the following sentence (the terms apply to MED-EL/MAESTRO; Cochlear and Advanced Bionics have equivalent filters under different names — your audiologist will know what is meant):

>"Please set up a test MAP for me on a free program position with all ASM filters disabled:
>
>- Microphone Directionality: Omni
>- Adaptive Intelligence: Off
>- Wind Noise Reduction: Off
>- Ambient Noise Reduction: Off
>- Transient Noise Reduction: Off
>
>Please leave Compression Ratio and all other map parameters unchanged. I only need this MAP for a loudness measurement at home."

### Additionally: ask your audiologist for the data of your MAP

In the *Implant* tab you can enter many technical values about your CI. The tool also works without these values, but the results and recommendations for the audiologist become more precise with them. You cannot find these values yourself — you have to ask your audiologist.

The following sentence helps:

>"Please print out a fitting report (all map parameters) of my current MAP for me. I need the values for a loudness measurement at home with the CI Sound Balancing Tool."

In case there are questions about which values are meant in detail:

>- Implant model and audio processor model
>- Coding strategy and stimulation rate
>- FAT (Frequency Allocation Table): centre frequency in Hz per electrode
>- THR (T-Level) per electrode
>- MCL per electrode
>- MED-EL: MCL in qu
>- Cochlear: C-Level in CL
>- Advanced Bionics: M-Level in CU
>- Status of each electrode (active / deactivated)
>- MED-EL additionally: MAPLAW c-value
>- Cochlear additionally: IIDR (Instantaneous Input Dynamic Range, in dB)
>- Advanced Bionics additionally: IDR (Input Dynamic Range, in dB)


## Workflow:
### Balancing the loudness
#### In the *Implant* tab:
Basic technical information about your CI.

- Select at the top the *LEFT/RIGHT* side on which you wear the CI.
- Enter at least your CI manufacturer; if known, also the model etc.
- Mark deactivated electrodes under *STATUS* as *DEACTIVATED*.
- Test the tone for each electrode. Mark conspicuous electrodes, e.g. with strong noise, under *STATUS*.
- Ideally enter all further values known to you. You can ask your audiologist for those values. You can also use the tool without these values.
- Also enter the information for the other ear. If you do not wear a CI on that side, also enter *normal hearing*, *hearing impaired* or *deaf* as appropriate.

#### In the *Measurement* tab
Comparison of the loudness of the electrodes.
- For the side(s) with a CI, start with only the *Electrode loudness* measurement.
- In this measurement, all electrodes are compared pairwise, and you adjust the loudness until both sides sound equally loud.
- Use Bluetooth streaming if possible.
- Set the volume to roughly 3/4: not quiet, but not unpleasantly loud either.
- Test controls:
  - Use the *arrow keys* to adjust the loudness.
  - Use the *spacebar* to replay the tone.
  - Once the tones sound equally loud, press *Enter* to confirm.
  - Optional: choose a different test tone.
- Recommended procedure:
  - First, the *Complete* test mode.
  - Then the *Convergence* test mode, repeated as often as you like.
  - Optional: enable *Fine-tuning* and run *Convergence* again.
- Any test can be interrupted at any time and resumed later at the same point.
- Any test can be repeated as often as needed to refine the results.
- Skip the *Stereo balance* and *Frequency matching* measurements for now.

#### In the *Results* tab
Display of the calculated fitting based on your measurements.

- In the *Electrode loudness* subtab you see the recommended changes per electrode as a graph.
- The colours of the bars per electrode indicate how reliable the measurement result is:
  - *red*: uncertain result, large deviations across the measurements
  - *yellow*: usable, decent, ok result
  - *green*: very good result, reliable
- The value *Residual* shows the reliability of the measurement as a mathematical value. A *Residual* < 1 is very good and is shown in *green*. It means that the deviation of the measurements is below 1 decibel.

#### In the *Player* tab
Play back an audio file to simulate the effect of your measurements.
- The built-in equalizer modifies the sound approximately as it would sound if the audiologist were to re-fit your CI according to your measurements.
- By balancing the electrode loudness of your CI you have already created a valuable foundation. Many things should already sound clearer than before.
- Toggle the *Measurement* button on and off several times to hear the difference.

#### In the *Curves* tab

In the *Curves* tab you can change the loudness of all electrodes together, following a curve. Several curve calculations are available.

Recommendations:
- Play an audio file in the *Player*. Use an audiobook.
- Activate *Speech*. Change the setting with the *up/down arrow keys* and listen live to how the change affects your speech intelligibility.
- Deactivate *Speech* and activate *Sine*. Play music in the *Player*. Change the value with the *up/down arrow keys* and listen live to how treble and bass change.
- Deactivate *Sine* and try out the other curves too.
- Find a curve or a combination of curves that appeals to you.
- Go to the *Player* tab, play something back, and toggle the *Curves* button on and off several times to hear the difference.

#### In the *Load/Save* tab
- Save your measurement data and settings.

## For your audiologist
Printouts for your audiologist with the requested changes.

- Set up everything in the *Player* the way you want to hear it.
  - Pay attention also to the *LEFT/RIGHT* setting and the *Both sides* checkbox.
- Go to the *Load/Save* tab and click *Print*.
- Set the player so that only loudness balancing is applied (button *Measured*). Disable the *Curves* and *Sliders* buttons. Print that too as the setting request for your future test program.
- Take the printouts with you to your next audiologist appointment.

### Recommendation for new program assignment
- Keep unchanged the program you are familiar with and use in daily life.
- Assign one program slot as a test program with exactly equally loud electrodes and no filters. This becomes your basis for future measurements and experiments.
- Assign one or two program slots with the preferred settings you have determined with the tool.

### Limitation
If you have entered the *MCL* values of the electrodes in the tool, the tool calculates — in addition to the difference in decibels (dB) — also a difference in the unit of the audiologist's program. This is included in the printout. These calculated values have not yet been verified for reliability. In addition, the ear as an organ may react somewhat differently to the settings than a calculation can predict.

## Further possibilities

### *Measurement* → *Stereo balance*
Allows loudness balancing between left and right.
- (Further documentation to follow.)

### *Measurement* → *Frequency matching*
Measurement of pitch differences between left and right.
- (Further documentation to follow.)
- (The *Player* can play back a simulation of altered pitches, but the quality of the simulation is still modest.)

### *Sliders* tab
Allows manual loudness adjustment of individual electrodes.
- (Further documentation to follow.)

## Speech Material and Sources

The sentences in the Player ("Play sentences") use speech recordings and
speech synthesis from the following open sources:

- **Thorsten-Voice** – German voice by Thorsten Müller,
  training data CC0. https://www.thorsten-voice.de
- **Piper TTS** – neural text-to-speech, MIT licence. Will be used in
  later stages for additional languages and speakers.
  https://github.com/rhasspy/piper

The selected sentences come from the Thorsten-Voice training corpus and
are not redistributed as text — only the 50 explicitly selected audio
snippets are included in the repo.
