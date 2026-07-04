#pragma once
#include <algorithm>
#include <numeric>
#include <random>
#include <string>
#include <vector>
#include <magic_enum/magic_enum.hpp>
#include <soemdsp/Wire.hpp>
#include <soemdsp/envelope/ExponentialEnvelope.hpp>
#include <soemdsp/envelope/LinearEnvelope.hpp>
#include <soemdsp/filter/OnePoleFilter.hpp>
#include <soemdsp/filter/Smoother.hpp>
#include <soemdsp/modulator/VibratoGenerator.hpp>
#include <soemdsp/oscillator/PolyBLEP.hpp>
#include <soemdsp/random/FlexibleRandomWalk.hpp>
#include <soemdsp/semath.hpp>
#include <RSMET/ArrayTools.hpp>
#include <RSMET/RAPT/RatioGenerator.h>
#include <RSMET/RAPT/ArrayTools.h>
#include <RSMET/SmoothingFilter.hpp>
namespace soemdsp::oscillator {
struct SupersawUnit {
    SupersawUnit() : SupersawUnit(0){};

    SupersawUnit(int idx)
      : idx_(idx) {
        drift_.method_ = convert::enum_to_double(modulator::FlexibleRandomWalk::Method::fixed_steps);
        osc_.increment_.pointTo(&smoothInc_.out_);
        double incrementMod{};
        double finalIncrement{};
    }

#pragma region UPDATE
    void sampleRateChanged() {
        drift_.sampleRateChanged();
        env_.sampleRateChanged();
    }

    // call whenever target pitch changes, pitch_ needs to be updated.
    void targetPitchChanged(double increment) {
        pitch_ = convert::freq_to_pitch(SampleRate::incrementToFrequency(increment));
    }

    // objects
    modulator::ExponentialDASR env_;
    oscillator::PolyBLEP osc_;
    filter::LinExpSmoother smoothInc_;
    modulator::FlexibleRandomWalk drift_;

    Wire driftAmp_;
    Wire vibratoAmp_;
    Wire vibratoSignal_; // use an outside vibrato object
    double pitch_{};             // only used to inform object, does not change object's pitch, updated by targetPitchChanged()
#pragma endregion

    double driftOut_{};
    double vibratoOut_{};
    double envelopeOut_{};
    double oscOut_{};
    double pitchCompensationOffset_{}; // if targetPitchChanged() is called, pitchCompensationOffset_ also needs to be
                                       // updated, this is done outside the object for efficiency
    double run() {
        driftOut_ = 0.0;
        if (driftAmp_ != 0.0) {
            driftOut_ = drift_.run() * driftAmp_;
        }

        vibratoOut_ = vibratoSignal_ * vibratoAmp_;

        //osc_.increment_.mw = SampleRate::frequencyToIncrement(convert::pitch_to_freq(pitch_ + (vibratoOut_ + driftOut_) * pitchCompensationOffset_)); // TODO

        return oscOut_ = osc_.runClamped() * env_.run();
    }

    void seedChanged() {
        // TODO: properly implemented
        // drift_.noiseGenerator_.seedChanged();
    }

    // set by Supersaw parent
    int idx_{};
    // equal to 1 / number of sawtooths for spreading things between 0 and 1 such as oscillator delay time.
    // set by Supersaw parent
    double div_{ 1.0 };

  private:
    double sawSquareMix{};
};

class SupersawMaster {
  public:
    static std::string algorithmString(int algo) {
        switch (algo) {
        case 0: return "Classic";
        case 1: return "Realistic";
        case 2: return "Emotional";
        case 3: return "Chordal";
        case 4: return "Linear";
        case 5: return "Exponential";
        default: debug::FAIL();
        }
        return {};
    }

    static void getNumOscillatorsAndAmplitudeValue(double value, int* numOscillatorsOut, double* amplitudeValueOut) {
        if (value <= 1.0) {
            *amplitudeValueOut = 1.00;
            *numOscillatorsOut = 1;
            return;
        }

        *amplitudeValueOut = std::fmod((value - 1.0) * 0.5, 1.0);
        *numOscillatorsOut = static_cast<int>(ceil(value));
        if (math::isEven(*numOscillatorsOut)) {
            ++(*numOscillatorsOut);
        }
    }

    static std::string resetPhaseString(int mode) {
        switch (mode) {
        case 0: return "Never";
        case 1: return "Legato";
        case 2: return "Always";
        default: debug::FAIL();
        }
    }

    static std::string vibratoModeString(int mode) {
        switch (mode) {
        case 0: return "Per Voice";
        case 1: return "Per Oscillator";
        default: debug::FAIL();
        }
        return {};
    }

    static void portamentoStyleString(double value, std::string* mode, double* curve) {
        if (value >= 0.0 && value < 0.5) {
            *curve = math::mapNtoN(value, 0.0, 0.5, -1.0, 1.0);
            *mode  = "Linear";
        } else {
            *curve = math::mapNtoN(value, 0.5, 1.0, 1.0, -1.0);
            *mode  = "Exponential";
        }
    }

    static void getCenterSideAmplitudeValue(double value, double* center, double* side) {
        // 0.0 -> 1.0
        // 0.5 -> 1.0
        // 1.0 -> 0.0
        *center = std::min(2.0 - value * 2.0, 1.0);

        // 0.0 -> 0.0
        // 0.5 -> 1.0
        // 1.0 -> 1.0
        *side = std::min(value * 2.0, 1.0);
    }

    SupersawMaster() {
        //memop::insertRandomNormalizedValues(randVibFreqsNormalized_, 0, randVibFreqsNormalized_.size(), [this]() { return random_.runUnipolar(); }); // TODO
        //memop::insertRandomNormalizedValues(randVibAmpsNormalized_, 0, randVibAmpsNormalized_.size(), [this]() { return random_.runUnipolar(); });   // TODO

        setupPortamentoRanged(0, numOscillatorsMax_);

        numOscillatorsChanged();
        for (size_t i = 0; i < oscArray_.size(); ++i) {
            oscArray_[i].smoothInc_.in_.pointTo(&incs_[i]);
            oscArray_[i].smoothInc_.linOrExp_.pointTo(portamentoMode_);
            oscArray_[i].smoothInc_.timeInSamples_.pointTo(&randPortaTimeInSamples_[i]);
        }

        oscResetRanged(0, numOscillatorsMax_);
    }

    void setPrimeTable(std::vector<unsigned int>* newTable) {
         ratioGenerator_.setPrimeTable(newTable);

        // Classic
         ratioGenerator_.setRatioKind(RAPT::rsRatioGenerator<double>::RatioKind::primePower);
         ratioGenerator_.setParameter1(1.0);
         ratioGenerator_.fillRatioTable(&incsClassic_[0], numOscillatorsMax_);

        // Realistic
         ratioGenerator_.setRatioKind(RAPT::rsRatioGenerator<double>::RatioKind::primePower);
         ratioGenerator_.setParameter1(1.e-8);
         ratioGenerator_.fillRatioTable(&incsRealistic_[0], numOscillatorsMax_);

        // Emotional
         ratioGenerator_.setRatioKind(RAPT::rsRatioGenerator<double>::RatioKind::primePowerDiff);
         ratioGenerator_.setParameter1(1.e-8);
         ratioGenerator_.fillRatioTable(&incsEmotional_[0], numOscillatorsMax_);

        // Chordal
         ratioGenerator_.setRatioKind(RAPT::rsRatioGenerator<double>::RatioKind::primePowerDiff);
         ratioGenerator_.setParameter1(1.0);
         ratioGenerator_.fillRatioTable(&incsChordal_[0], numOscillatorsMax_);

        // Linear
         ratioGenerator_.setRatioKind(RAPT::rsRatioGenerator<double>::RatioKind::linToExp);
         ratioGenerator_.setParameter1(0.0);
         ratioGenerator_.fillRatioTable(&incsLinear_[0], numOscillatorsMax_);

        // Exponential
         ratioGenerator_.setRatioKind(RAPT::rsRatioGenerator<double>::RatioKind::linToExp);
         ratioGenerator_.setParameter1(1.0);
         ratioGenerator_.fillRatioTable(&incsExponential_[0], numOscillatorsMax_);
    }

#pragma region UPDATE
    void sampleRateChanged() {
        for (int i = 0; i < numOscillators_; ++i) {
            oscArray_[i].env_.sampleRateChanged();
        }
        oscArray_[0].drift_.sampleRateChanged();

        vibratoFreqChanged();
    }

    void detuneAlgorithmChanged() {
        switch (convert::double_to_int(detuneAlgorithm_)) {
        case 0:
            incs_ = incsClassic_;
            break;
        case 1:
            incs_ = incsRealistic_;
            break;
        case 2:
            incs_ = incsEmotional_;
            break;
        case 3:
            incs_ = incsChordal_;
            break;
        case 4:
            incs_ = incsLinear_;
            break;
        case 5:
            incs_ = incsExponential_;
            break;
        }
    }

    // call when masterIncrement_ or detune_ changes as well as detune algorithm or detune curve
    void incrementChanged() {
        detuneAlgorithmChanged();
        detuneChanged();

        // tune the increment spread
        double incOffset = masterIncrement_ - centerIncrement_ * masterIncrement_;

        // multiply in the reference increment:
        for (int i = 0; i < numOscillators_; i++) {
            incs_[i] = abs(incs_[i] * masterIncrement_ + incOffset);
            oscArray_[i].smoothInc_.incrementChanged();
            oscArray_[i].targetPitchChanged(incs_[i]);
        }

        pitchCompensationChangedRanged(0, numOscillators_);
    }

    void detuneChanged() {
        // prevent incs[0] becoming NaN when calling transformRange when numOscillators_ is 1
        if (numOscillators_ == 1) {
            incs_[0] = 1.0;
            return;
        }

        absDetune_ = abs(detune_);

        if (detune_ < 0.0) {
            invertIncrements(incs_, incs_);
        }

        // transform the increments to their actual target range:
        double minRatio = 1.0 - 0.5 * absDetune_;
        double maxRatio = 1.0 + 0.5 * absDetune_;

        rsmet::arraytools::transformRange(&incs_[0], &incs_[0], numOscillators_, minRatio, maxRatio);

        centerIncrement_ = incs_[static_cast<size_t>(round(numOscillators_ / 2.0))];
    }

    // returns true if numOscillators actually changed
    bool numOscillatorsChanged() {
        getNumOscillatorsAndAmplitudeValue(numOscillatorsFloatValue_, &numOscillators_, &lastTwoOscillatorsAmplitude_);

        if (numOscillators_ == prevNumOscillators_) {
            return false;
        }

        debug::CHECK(numOscillators_ >= 1 && numOscillators_ <= numOscillatorsMax_, "numOscillators were set higher than max.");

        for (int i = 0; i < numOscillators_; ++i) {
            oscArray_[i].idx_ = i;
            oscArray_[i].div_ = 1.0 / static_cast<double>(numOscillators_) * static_cast<double>(i);
        }

        sampleRateChanged();

        if (prevNumOscillators_ < numOscillators_) {
            // adding oscillators
            portamentoChangedRanged(prevNumOscillators_, numOscillators_);
            vibratoAmpChangedRange(prevNumOscillators_, numOscillators_);
            incrementChangedRanged(prevNumOscillators_, numOscillators_);
            vibratoFreqChangedRanged(prevNumOscillators_, numOscillators_);
            for (int i = prevNumOscillators_; i < numOscillators_; ++i) {
                oscArray_[i].smoothInc_.setState(oscArray_[0].smoothInc_.out_);
                oscArray_[i].env_.transferState(oscArray_[0].env_);
            }
        } else {
            // removing oscillators
            for (int i = prevNumOscillators_; i-- > numOscillators_;) {
#pragma warning(push)
#pragma warning(disable : 28020)
                oscArray_[i].env_.reset();
#pragma warning(pop)
            }
        }

        prevNumOscillators_ = numOscillators_;

        return true;
    }

    void pitchCompensationChanged() {
        pitchCompensationChangedRanged(0, numOscillators_);
    }

    void vibratoModeChanged() {
        switch (convert::double_to_int(vibratoMode_)) {
        case 0: // Per Voice
            vibratoArray_[0].increment_ = SampleRate::frequencyToIncrement(vibratoFreqMax_);
            vibratoArray_[0].incrementChanged();
            for (size_t i = 0; i < oscArray_.size(); ++i) {
                oscArray_[i].vibratoSignal_.pointTo(&vibratoArray_[0].oscOut_);
            }
            return;
        case 1: // Per Oscillator
            vibratoArray_[0].increment_ = SampleRate::frequencyToIncrement(math::map0to1<double>(randVibFreqsNormalized_[0], vibratoFreqMin_, vibratoFreqMax_));
            vibratoArray_[0].incrementChanged();
            for (size_t i = 0; i < oscArray_.size(); ++i) {
                oscArray_[i].vibratoSignal_.pointTo(&vibratoArray_[i].oscOut_);
            }
            return;
        }
    }

    void vibratoFreqChanged() {
        vibratoFreqChangedRanged(0, numOscillators_);
    }

    void vibratoAmpChanged() {
        vibratoAmpChangedRange(0, numOscillators_);
    }

    // This is optional, only call if you want realtime modulation of random phases
    void randomPhaseRangeChanged() {
        modulatePhasesRanged(0, numOscillators_);
    }

    // This is optional, only call if you want realtime modulation of portamento times
    void portamentoChanged() {
        portamentoChangedRanged(0, numOscillators_);
    }

    void portamentoCurveChanged() {
        debug::CHECK(portamentoStyle_ >= 0.0 && portamentoStyle_ <= 1.0, "parameter out of range");
        if (portamentoStyle_ >= 0.0 && portamentoStyle_ < 0.5) {
            portamentoCurveValue_ = math::mapNtoN<double>(portamentoStyle_, 0.0, 0.5, -1.0, 1.0);
            portamentoMode_       = 0;
        } else {
            portamentoCurveValue_ = math::mapNtoN<double>(portamentoStyle_, 0.5, 1.0, 1.0, -1.0);
            portamentoMode_       = 1;
        }
        applyPortamentoValuesRanged(0, numOscillators_);
    }

    /* Base parameters */
    static const int numChannels_       = 2;
    static const int numOscillatorsMax_ = 63;
    Wire numOscillatorsFloatValue_{ 1.0 }; // numOscillatorsFloatValue_ is a double value of 1 to 63

    /* Phase parameters */
    Wire randomPhaseRange_{ 1.0 }; // randomPhaseRangeChanged()
    Wire phaseResetMode_{ 2 };        // 0=Never, 1=Legato, 2=Always

    /* Pitch Parameters */
    Wire masterIncrement_;
    Wire portamentoStyle_; // portamentoCurveChanged()
    Wire portaTimeMin_;    // portamentoChanged()
    Wire portaTimeMax_;    // portamentoChanged()

    /* Detune Parameters */
    Wire detuneAlgorithm_;
    Wire detune_; // -inf to +inf in semitones (negative values gives acces to alternative detune algorithm

    /* Drift & Vibrato Parameters */
    Wire pitchCompensation_; // -1.0 to +1.0
    Wire vibratoMode_;
    Wire vibratoFreqMin_;
    Wire vibratoFreqMax_;
    Wire vibratoAmpMin_;
    Wire vibratoAmpMax_;

    /* Amplitude Parameters */
    Wire centerSideCrossfade_{ 0.5 };
    Wire velocity_{ 1.0 };
    Wire velocitySensitivity_;

    /* Envelope Parameters */
    Wire delayMin_; // recommended to leave at 0.0
    Wire delayMax_; // recommended to only change delayMax
    Wire attackMin_;
    Wire attackMax_;
    Wire releaseMax_;
    Wire releaseMin_;
#pragma endregion

    bool isIdle() {
        return isIdle_;
    }

    void envReset() {
        for (auto& osc : oscArray_) {
            osc.env_.reset();
        }
    };

    void oscReset() {
        oscResetRanged(0, numOscillators_);
    }

    void triggerAttack(bool doPortamento) {
        std::vector<size_t> randVec(numOscillators_);
        std::iota(randVec.begin(), randVec.end(), 0);
        std::shuffle(randVec.begin(), randVec.end(), std::default_random_engine(0)); // TODO(argit): have a seed

        if (doPortamento) {
            setupPortamentoRanged(0, numOscillators_);
        } else {
            for (int i = 0; i < numOscillators_; ++i) {
                oscArray_[i].smoothInc_.reset();
            }
        }

        // if not Never reset, then attempt reset per oscillator
        if (convert::double_to_bool(phaseResetMode_)) {
            oscResetRanged(0, numOscillators_);
        }

        for (int i = 0; i < numOscillators_; ++i) {
            auto& osc             = oscArray_[randVec[i]];
            osc.env_.delayTime_.w = math::map0to1<double>(random_.runUnipolar() * curve::Rational{ -0.5 }.get(oscArray_[i].div_), delayMin_, delayMax_);

            osc.env_.attackTime_.w = math::map0to1<double>(random_.runUnipolar(), attackMin_, attackMax_);
            osc.env_.attackTimeChanged();

            osc.env_.releaseTime_.w = math::map0to1<double>(random_.runUnipolar(), releaseMin_, releaseMax_);
            osc.env_.releaseTimeChanged();

            osc.env_.triggerAttack();
        }
    }

    void triggerRelease() {
        for (int i = 0; i < oscArray_.size() && i < numOscillators_; ++i) {
            oscArray_[i].env_.triggerRelease();
        }
    }

    std::array<double, numChannels_> run() {
        std::array<double, numChannels_> out{ 0.0 };

        isIdle_ = true;

        double ampForCenter;
        double ampForSides;
        getCenterSideAmplitudeValue(centerSideCrossfade_, &ampForCenter, &ampForSides);

        vibratoArray_[0].run();

        if (!oscArray_[0].env_.isIdle()) {
            out[0]  = oscArray_[0].run() * ampForCenter;
            out[1]  = out[0];
            isIdle_ = false;
        }

        for (size_t i = 1; i < numOscillators_; ++i) {
            if (!oscArray_[i].env_.isIdle()) {
                double amplitude = 1.0;

                if (i + 2 >= numOscillators_) { // check if we are on the last two oscillator indexes
                    amplitude = lastTwoOscillatorsAmplitude_;
                }

                if (vibratoMode_ == 1) {
                    vibratoArray_[i].run(); // osc internally connected to a vibrato instance
                }
                out[i % numChannels_] += oscArray_[i].run() * amplitude * ampForSides;
                isIdle_ = false;
            }
        }

        double velocityMult = math::valFromVelocityAndSensitivity(velocity_, velocitySensitivity_);
        out[0] *= velocityMult;
        out[1] *= velocityMult;

        return out;
    }

    std::array<SupersawUnit, numOscillatorsMax_> oscArray_;
    std::array<modulator::VibratoGenerator, numOscillatorsMax_> vibratoArray_;
    bool isIdle_{};
    random::LCG64 random_;
    RAPT::RatioGenerator ratioGenerator_; // call setPrimeTable(&primeTable) otherwise Supersaw won't work

    std::array<double, numOscillatorsMax_> incs_{};

    std::array<double, numOscillatorsMax_> incsClassic_{};
    std::array<double, numOscillatorsMax_> incsRealistic_{};
    std::array<double, numOscillatorsMax_> incsEmotional_{};
    std::array<double, numOscillatorsMax_> incsChordal_{};
    std::array<double, numOscillatorsMax_> incsLinear_{};
    std::array<double, numOscillatorsMax_> incsExponential_{};
    std::array<double, numOscillatorsMax_> incsInverted_{};

    std::array<double, numOscillatorsMax_> randVibFreqsNormalized_;
    std::array<double, numOscillatorsMax_> randVibAmpsNormalized_;
    std::array<double, numOscillatorsMax_> randPhasesNormalized_{ 1.0 };
    std::array<double, numOscillatorsMax_> randPortaTimesNormalized_;
    std::array<double, numOscillatorsMax_> randPortaTimeInSamples_;

  private:
    double absDetune_{};
    double centerIncrement_{};
    double prevPortaSamples_{};
    double portamentoCurveValue_{ -0.5 };
    Wire portamentoMode_{}; // 0 = Linear, 1 = Exponential

    int numOscillators_{ 1 };
    int prevNumOscillators_{ 0 };
    double lastTwoOscillatorsAmplitude_{};

    void setupPortamentoRanged(int startIdx, int endIdx) {
        //memop::insertRandomNormalizedValues(randPortaTimesNormalized_, startIdx, endIdx, [this]() { return random_.runUnipolar(); }); // TODO
        applyPortamentoValuesRanged(startIdx, endIdx);
    }

    void applyPortamentoValuesRanged(int startIdx, int endIdx) {
        for (size_t i = static_cast<size_t>(startIdx); i < endIdx; ++i) {
            randPortaTimeInSamples_[i] = SampleRate::timeToSamples(math::map0to1<double>(curve::Rational{ portamentoCurveValue_ }.get(randPortaTimesNormalized_[i]), portaTimeMin_, portaTimeMax_));
        }
        for (size_t i = static_cast<size_t>(startIdx); i < endIdx; ++i) {
            oscArray_[i].smoothInc_.incrementChanged();
        }
    }

    void modulatePhasesRanged(int startIdx, int endIdx) {
        for (int i = startIdx; i < endIdx; ++i) {
            oscArray_[i].osc_.phaseOffset_ = math::map0to1<double>(randPhasesNormalized_[i], 0.0, randomPhaseRange_);
        }
    }

    void oscResetRanged(int startIdx, int endIdx) {
        //memop::insertRandomNormalizedValues(randPhasesNormalized_, startIdx, endIdx, [this]() { return random_.runUnipolar(); }); //TODO
        double maxPhaseRange_ = std::min<double>(randomPhaseRange_, 1.0 - 1.0 / static_cast<double>(numOscillators_));
        for (int i = startIdx; i < endIdx; ++i) {
            if (oscArray_[i].env_.isIdle() || (!oscArray_[i].env_.isIdle() && phaseResetMode_ == 2)) {
                oscArray_[i].osc_.reset();
                oscArray_[i].osc_.phaseOffset_ = math::map0to1<double>(randPhasesNormalized_[i], 0.0, maxPhaseRange_);
                oscArray_[i].drift_.reset();
            }
        }
    }

    void portamentoChangedRanged(int startIdx, int endIdx) {
        for (size_t i = startIdx; i < endIdx; ++i) {
            oscArray_[i].smoothInc_.timeInSamples_ = SampleRate::timeToSamples(math::map0to1<double>(randPortaTimesNormalized_[i], portaTimeMin_, portaTimeMax_));
            oscArray_[i].smoothInc_.incrementChanged();
            oscArray_[i].targetPitchChanged(incs_[i]);
            pitchCompensationChangedRanged(startIdx, endIdx);
        }
    }

    void pitchCompensationChangedRanged(int startIdx, int endIdx) {
        debug::CHECK(pitchCompensation_ >= -1.0 && pitchCompensation_ <= 1.0, "parameter out of range");

        const double minPitch{ 23.0 };      // lowest pitch that modulation increases/decreases
        const double maxPitch{ 103.0 };     // highest pitch that modulation increases/decreases
        const double minPitchComp{ 0.0 };   // minimum modulation multiplier
        const double maxPitchComp{ 10.0 };  // maximum modulation multiplier
        const double curveVariable{ 0.95 }; // controls how modulation multipliers transitions to min/max so it's not a
                                            // hard cut off but a gradual slope

        const double absPitchComp    = abs(pitchCompensation_);
        const double minMultiplier   = math::map0to1(absPitchComp, 1.0, minPitchComp);
        const double maxMultiplier   = math::map0to1(absPitchComp, 1.0, maxPitchComp);
        const double pitchNormalized = math::mapNtoN(std::clamp(oscArray_[0].pitch_, minPitch, maxPitch), minPitch, maxPitch, 0.0, 1.0);

        if (pitchCompensation_ >= 0.0) {
            const double compensation = math::map0to1(curve::Rational{ +curveVariable }.get(pitchNormalized), maxMultiplier, minMultiplier);
            for (size_t i = static_cast<size_t>(startIdx); i < static_cast<size_t>(endIdx); ++i) {
                oscArray_[i].pitchCompensationOffset_ = compensation;
            }
        } else {
            const double compensation = math::map0to1(curve::Rational{ -curveVariable }.get(pitchNormalized), minMultiplier, maxMultiplier);
            for (size_t i = static_cast<size_t>(startIdx); i < static_cast<size_t>(endIdx); ++i) {
                oscArray_[i].pitchCompensationOffset_ = compensation;
            }
        }
    }

    void vibratoAmpChangedRange(int startIdx, int endIdx) {
        for (int i = startIdx; i < endIdx; ++i) {
            oscArray_[i].vibratoAmp_ = math::map0to1<double>(randVibAmpsNormalized_[i], vibratoAmpMin_, vibratoAmpMax_);
        }
    }

    void incrementChangedRanged(int startIdx, int endIdx) {
        detuneAlgorithmChanged();
        detuneChanged();

        // tune the increment spread
        double incOffset = masterIncrement_ - centerIncrement_ * masterIncrement_;

        // multiply in the reference increment:
        for (int i = startIdx; i < endIdx; i++) {
            incs_[i] = incs_[i] * masterIncrement_ + incOffset;
            oscArray_[i].smoothInc_.incrementChanged();
        }
    }

    void vibratoFreqChangedRanged(int startIdx, int endIdx) {
        const double min = SampleRate::frequencyToIncrement(vibratoFreqMin_);
        const double max = SampleRate::frequencyToIncrement(vibratoFreqMax_);
        for (int i = startIdx; i < endIdx; ++i) {
            vibratoArray_[i].increment_ = math::map0to1(randVibFreqsNormalized_[i], min, max);
            vibratoArray_[i].incrementChanged();
        }
        if (vibratoMode_ == 0) {
            vibratoArray_[0].increment_ = max;
            vibratoArray_[0].incrementChanged();
        }
    }

    void invertIncrements(std::array<double, numOscillatorsMax_>& inputArray, std::array<double, numOscillatorsMax_>& outputArray) {
        // ratios in 1...2
        rsmet::arraytools::transformRange(&inputArray[0], &outputArray[0], numOscillators_, 1.0, 2.0);

        for (int i = 0; i < numOscillators_; i++) {
            // ratios in 0.5...1
            outputArray[i] = 1.0 / outputArray[i];
        }

        rsmet::arraytools::reverse_inplace(&outputArray[0], numOscillators_);
    }
};
} // namespace soemdsp::oscillator
