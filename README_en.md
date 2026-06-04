# CI Sound Balancing Tool

![](favicon.png)

This tool is designed for cochlear implant users to measure their perceived loudness and pitches.
- Based on the measurement results, audio files can be played back with a simulated adjustment.
- As soon as it sounds good to you, you can print an overview of the desired changes for your audiologist.

You can find the tool here, running online in the browser: [CI Sound Balancing Tool](https://mviereck.github.io/ci-sound-balancing/)

You can also use the tool offline. [Download as ZIP file](https://github.com/mviereck/ci-sound-balancing/archive/refs/heads/main.zip). After unpacking, the tool opens in the browser by double-clicking *index.html*.

The tool supports devices from all three major manufacturers: MED-EL, Cochlear, and Advanced Bionics.

## Background

The goal is for all electrodes to sound equally loud ("loudness balancing"), and for pitches to be perceived as equally high or low on the left and right.

This balancing of electrode loudness (per CI) and pitches (left/right) is the basis for pleasant and as natural as possible hearing.

Audiologists usually do not have enough time to carry out these measurements with the required thoroughness. This is where this tool helps: you can perform the measurements alone at home, without any time pressure.

Based on these self-determined measurement data, a simulated adjustment can be played back in the integrated audio player. This way, you can estimate in advance what sounds best for you.

In addition to the pure balancing of loudness and pitch, you can make semi-automatic adjustments to improve speech intelligibility, or, for example, emphasize bass or treble. You can hear the effect of your adjustments live if you simultaneously let music or an audiobook play in the audio player.

When you have finally found an adjustment that seems good to you, you can print out the necessary changes and give them to your audiologist.

## Limitation

The tool works exclusively with acoustic signals. Acoustic signals can also activate neighboring electrodes. This makes the measurement somewhat imprecise. Ideal would be a direct stimulation of the individual electrodes, but this possibility is reserved for the audiologist.

## Important recommendation: test program without filters

So that you can judge the loudness of the individual electrodes as unaltered as possible, all automatic sound processing filters in the CI processor should be deactivated. Ask your audiologist to set up an additional test program for this purpose.

You can use the following sentence (the terms apply to MED-EL/MAESTRO; with Cochlear and Advanced Bionics there are corresponding filters under other names, the audiologist knows what is meant):

>"Please set up a test MAP on a free program slot for me, with all ASM filters deactivated:
>
>- Microphone Directionality: Omni
>- Adaptive Intelligence: Off
>- Wind Noise Reduction: Off
>- Ambient Noise Reduction: Off
>- Transient Noise Reduction: Off
>
>Please leave Compression Ratio and other MAP parameters unchanged. I only need this MAP for a loudness measurement at home."

### Additionally: ask the audiologist for the data of your MAP

In the Implant tab, you can enter numerous technical values for your CI. The tool also works without these values; with them, however, the results and recommendations for the audiologist become more precise. You cannot find these values yourself, but must ask the audiologist for them.

The following sentence helps:

>"Please print me a fitting report (all MAP parameters) of my current MAP. I need the values for a loudness measurement at home with the CI Sound Balancing Tool."

In case of follow-up questions about which values are specifically meant:

>- Implant model and audio processor model
>- Coding strategy and stimulation rate
>- FAT (Frequency Allocation Table): center frequency per electrode in Hz
>- THR (T-Level) per electrode
>- MCL per electrode
>- MED-EL: MCL in qu
>- Cochlear: C-Level in CL
>- Advanced Bionics: M-Level in CU
>- Status of each electrode (active / deactivated)
>- MED-EL additionally: MAPLAW c-value
>- Cochlear additionally: IIDR (Instantaneous Input Dynamic Range, in dB)
>- Advanced Bionics additionally: IDR (Input Dynamic Range, in dB)


## Procedure:
### Balance loudness
#### In the *Implant* tab:
Basic technical information about your CI.

- Select the side *LEFT/RIGHT* at the top on which you wear your CI.
- Enter at least your CI manufacturer, and, if known, also model etc.
- Mark deactivated electrodes under *ACTIVE* as *DEACTIVATED* (remove checkmark).
- Test the tone for each electrode. Mark conspicuous electrodes, e.g. with strong noise, in *STATUS*.
- Ideally, also enter all other information and values known to you, if known. You can ask your audiologist for the values. But you can also use the tool without these values.
- Also make all entries for the other ear. Also enter *normal hearing* or *hard of hearing* or *deaf* if applicable, if you do not wear a CI there.

#### In the *Measurements* tab -> *Electrode loudness*
Comparison of the loudness of the electrodes.
- For the side(s) with a CI, first only perform the *Electrode loudness* measurement.
- In this measurement, all electrodes are compared in pairs, and you adjust the loudness until both electrodes sound equally loud.
- If possible, use Bluetooth for streaming.
- Set the volume of your computer (or smartphone) to about 3/4, not quiet, but not yet uncomfortably loud.
- Test controls:
  - Use the *arrow keys* to adjust the loudness.
  - Use the *space bar* to replay the tone.
  - As soon as the tones are equally loud, confirm with *Enter*.
  - Optional: choose a different tone for testing.
    - Note: there are several tones to choose from.
      - Sine is the default, complex is also very good.
      - Narrow-band noise can lead to surprisingly large deviations in the measurement.
        Use this tone only experimentally at first, or as a completely separate test series independent of a sine tone measurement.
- Recommended procedure:
  - First the *Complete* test procedure.
  - Then the *Convergence* test procedure, possibly several times.
  - Below the slider, a marker with a calculated estimate and uncertainty range is displayed. This cannot be relied on, but can provide a reference point.
- Each test can be paused at any time and continued later at the same point.
- Each test can be repeated any number of times to refine the results.
- Skip the *Stereo balance* and *Frequency matching* measurements at first.

#### In the *Measurement results* tab -> *Electrode loudness*
Display of the calculated adjustment according to your measurements.

- In the *Electrode loudness* sub-tab, you see the recommended changes per electrode displayed in a graphic.
- The colors of the bars per electrode indicate how reliable the measurement result is:
  - *red*: result uncertain, large deviations in the measurements
  - *yellow*: result usable, good, ok
  - *green*: very good result, reliable
- The value *residual* shows the reliability of the measurement as a mathematical value. A *residual* <1 is very good and is displayed in *green*. This means that the deviation of the measurements is below 1 decibel.

#### In the *Player* tab
Play an audio file to simulate the effect of your measurements.
- The built-in equalizer changes the sound approximately as it would sound if the audiologist readjusted your CI according to your measurements.
- With the balancing of the electrode loudness of your CI, you have created a valuable basis. With this, much should already sound clearer than before.
- Turn the *Measurements* button on and off several times to hear the difference.

#### In the *Curves* tab

In the *Curves* tab, you can change the loudness of all electrodes together following a curve. Different curve calculations are available for this.

Recommendations:
- Let an audio file play in the *Player*. Take an audiobook.
- Activate *Speech*. Change the setting with the *up/down arrow keys* and listen live to how the change affects your speech understanding.
- Deactivate *Speech* and activate *Sine*. Let music play in the *Player*. Change the value with the *up/down arrow keys* and listen live to how treble and bass change.
- Deactivate *Sine* and try other curves as well.
- Find a curve or combination of curves that appeals to you.
- Go to the *Player* tab, play something, and turn the *Curves* button on and off several times to hear the difference.

#### In the *Load/Save* tab
- Back up your measurement data and your settings.

## For your audiologist
Printouts for your audiologist with the desired changes.

- Set everything in the *Player* the way you want to hear it.
  - Also pay attention to the *LEFT/RIGHT* setting and the *Both sides* checkbox.
- Go to the *Load/Save* tab and click on *Print*.
- Set the player so that only loudness balancing is done (button *Measured*). Deactivate the *Curves* and *Sliders* buttons. Print that out as well as a settings request for your future test program.
- Take the printouts with you to your next audiologist appointment.

### Recommendation for new program allocation
- Keep unchanged the program that you have been used to so far and that you use in everyday life.
- Allocate a program slot as a test program with exactly equally loud electrodes without filters. This will be your basis for future measurements and experiments.
  - This test program could also become a favorite program for music or natural sounds for you.
- Allocate one or two program slots with desired settings that you have determined with the help of the tool.

### Limitation
If you have entered the *MCL* values of the electrodes in the tool, the tool also calculates a difference in the unit of the audiologist program in addition to the difference in decibels (dB). This is also printed out. These calculated values have not yet been verified for reliability. In addition, the ear as an organ may react somewhat differently to the settings than a calculation can predict.

## Further measurements

### *Measurements* tab -> *Stereo balance*
Loudness comparison left and right.
- Before this measurement, the *Electrode loudness* measurement should already have been performed.
- From the measurement, a mean is calculated, which is recommended as a recommendation for loudness boost or attenuation for one side.
- The balancing can be activated in the player via a button.

### *Measurements* tab -> *Latency*
Measure the time offset between left and right.
- With different provision on the left and right, the tones can arrive with a time offset.
- With this test you can measure this latency. Depending on the device, a correction can be made by the audiologist or hearing care professional.
- If the loudness on the left and right is very well balanced, you can also pay attention to "where" you hear the sound as a guide. More to the left, right, or centered in the head.
- A compensation can be activated in the player.

This measurement procedure is still somewhat rudimentary and is to be refined in future versions.

### *Measurements* tab -> *Frequency matching*
Measurement of pitch differences left and right.
- It is advantageous to have already performed *Electrode loudness* and *Stereo balance* before this measurement.

The procedure is divided into 2 tests. The first test with slider only serves to obtain good starting values for the time-intensive second test.
#### Test 1: pre-estimate (slider)
- For each electrode, the same tone is played on the left and right. Correct with the slider / with the arrow keys until the tones sound equally high or low on the left and right.
#### Test 2: adaptive
- Tone sequences are played, and for each tone sequence you indicate whether the second tone was higher or lower than the first.
- At some point you will reach a point where you can hardly or no longer distinguish this. Then answer intuitively, even if the mind no longer detects a difference.
#### Player
- In the *Player*, a simulation of changed pitches can be played back under *Experimental*, but the quality of the simulation is still modest. However, it can give an idea of how the change could work.
#### Note on hearing aids:
- If you hear naturally on the other ear, but are hard of hearing, it can help to have the hearing aid set up for the test so that it does not perform any frequency shifting, but only improves the loudness.
- If you wear a hearing aid on the other ear that performs frequency shifting, for example reproducing high tones as lower tones, it is not suitable for the test. You would test with the shifted frequencies.

### *Sliders* tab
Allows manual loudness change of individual electrodes.
- You will usually not need this function. It gives you freedom for experiments.
- There is a *relative* and an *absolute* mode. The *absolute* mode is only usable if the MCL values have been entered in the *Implant* tab.
- You can have the change by *Electrode loudness* and *Curves* displayed.
- You can hear the changes live in the player.

