#pragma once

#include <numeric>
#include <vector>

#include <soemdsp/filter/OnePoleFilter.hpp>
#include <soemdsp/envelope/ExponentialEnvelope.hpp>
#include <soemdsp/envelope/LinearEnvelope.hpp>
#include <soemdsp/modulator/VibratoGenerator.hpp>
#include <soemdsp/oscillator/PolyBLEP.hpp>
#include <soemdsp/random/FlexibleRandomWalk.hpp>
#include <soemdsp/semath.hpp>

namespace soemdsp::oscillator {

class HypersawUnit {
  public:
    // Copy constructor
    HypersawUnit(const HypersawUnit&)            = default; // copy constructor
    HypersawUnit(HypersawUnit&&)                 = default; // move constructor
    ~HypersawUnit()                              = default; // destructor (virtual if class is meant to be a base class)
    HypersawUnit& operator=(const HypersawUnit&) = default; // copy assignment
    HypersawUnit& operator=(HypersawUnit&&)      = default; // move assignment

    HypersawUnit() {
        osc_.waveform_ = convert::enum_to_double(PolyBLEP::Shape::Saw);
        osc_.morph_    = 1;
        drift_.method_ = convert::enum_to_double(modulator::FlexibleRandomWalk::Method::fixed_steps);
    }

#pragma region UPDATE
    void sampleRateChanged() {
        drift_.sampleRateChanged();
        env_.sampleRateChanged();
        // osc_.sampleRateChanged(); // for DSF
    }

    void incrementChanged() {
        // osc_.incrementChanged(); // for DSF
    }

    void morphChanged() {
        // osc_.morphChanged(); // for DSF
    }

    /* classes */
    // DSFOscillatorSineSaw osc_;
    PolyBLEP osc_;
    modulator::ExponentialDASR env_;
    modulator::FlexibleRandomWalk drift_;
    random::LCG64 random_; /* ORACLE */          // unipolar
    random::LCG64 bipolarNoiseGen_; /* ORACLE */ // bipolar

    /* Vibrato Phase Parameters */
    Wire vibInput_;  // connect to the output of a vibrato oscillator
    Wire vibOffset_; // offsets the phase vibrato signal
    Wire vibAmp_;    // amplifies the phase vibrato signal

    /* Random and Fixed Phase Parameters */
    Wire randomPhaseAmp_;     // multiplies randomPhaseOffset_ to grow/shrink its range
    Wire distributePhaseAmp_; // multiplies randomPhaseOffset_ to grow/shrink its range

    Wire driftAmp_;
#pragma endregion

    double walkOut_{};
    double envelopeOut_{};
    double vibratoOut_{};

    double run() {
        walkOut_ = 0.0;
        if (driftAmp_ > 0) {
            walkOut_ = drift_.run() * driftAmp_;
        }

        // vibratoOut_      = vibInput_ * vibAmp_ + vibOffset_;
        // double phase     = (div_ * distributePhaseAmp_) + (div_ * vibratoOut_) + (randomPhaseOffset_ *
        // randomPhaseAmp_); osc_.phaseOffset__ = phase + walkOut_;

        double phase      = (div_ * distributePhaseAmp_) + (div_ * vibratoOut_) + (randomPhaseOffset_ * randomPhaseAmp_);
        osc_.phaseOffset_ = phase * ((vibInput_ * vibAmp_) + vibOffset_) + walkOut_;

        return osc_.run() * env_.run();
    }

    void seedChanged() {
        drift_.noiseGenerator_.reset();
        random_.reset();
        bipolarNoiseGen_.reset();
    }

    void envReset() {
        env_.reset();
        osc_.reset();
    }

    void randomizePhase() {
        randomPhaseOffset_ = bipolarNoiseGen_.runBipolar();
    }

    double randomPhaseOffset_{}; // +/- offset added to div_

    // equal to 1 / number of sawtooths for spreading things between 0 and 1 such as oscillator phase.
    // set by Hypersaw parent
    double div_{ 1.0 };
};

class HypersawMaster {
  public:
    HypersawMaster() {
        numOscillatorsChanged();

        for (int i = 1; i < oscArray_.size(); ++i) {
            oscArray_[i].vibInput_.pointTo(&vibOsc_.out_);
            oscArray_[i].drift_.lpf_.slave(oscArray_[0].drift_.lpf_);
        }

        // vibOsc_.phase_.vmw_ = random_.run();
        vibOsc_.phaseOffset_ = 0.5;
    }
#pragma region UPDATE
    void sampleRateChanged() {
        for (auto& osc : oscArray_) {
            osc.env_.sampleRateChanged();
        }
        oscArray_[0].drift_.sampleRateChanged();
    }

    void incrementChanged() {
        oscArray_[0].incrementChanged();
    }

    void morphChanged() {
        oscArray_[0].morphChanged();
    }

    // returns true if numOscillators actually changed
    bool numOscillatorsChanged() {
        if (compare::is_equal(numOscillators_, prevNumOscillators_)) {
            return false;
        }

        debug::CHECK(numOscillators_ <= numOscillatorsMax_, "numOscillators were set higher than max.");

        double add   = 1.0 / static_cast<double>(numOscillators_);
        double delta = 0;
        for (int i = 0; i < numOscillators_; ++i) {
            oscArray_[i].osc_.reset();
            oscArray_[i].div_ = delta;
            delta += add;
        }

        sampleRateChanged();

        if (prevNumOscillators_ < numOscillators_) {
            // adding oscillators
            for (int i = prevNumOscillators_; i < numOscillators_; ++i) {
                oscArray_[i].env_.transferState(oscArray_[0].env_);
            }
        } else {
            // removing oscillators
            for (int i = prevNumOscillators_; i-- > numOscillators_;) {
                oscArray_[i].env_.reset();
            }
        }

        prevNumOscillators_ = numOscillators_;

        return true;
    }

    void driftFrequencyChanged() {
        oscArray_[0].drift_.frequencyChanged();
    }
    void driftJitterChanged() {
        oscArray_[0].drift_.jitterChanged();
    }

    /* Base parameters */
    static const int numChannels_       = 2;
    static const int numOscillatorsMax_ = 64;
    Wire numOscillators_{ 1 }; // numOscillatorsChanged()

    /* Amplitude Parameters */
    Wire centerSideCrossfade_{ 0.5 };
    Wire velocity_{ 1.0 };
    Wire velocitySensitivity_;

    /* Phase Parameters */
    oscillator::PolyBLEP vibOsc_;
    Wire phaseResetMode_{ 1 }; // 0=Never, 1=Legato, 2=Always
    Wire driftFrequency_;   // connect this to all oscillator drift_.frequency_, see driftFrequencyChanged()

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
            osc.envReset();
        }
    };

    void oscReset() {
        oscResetRanged(0, numOscillators_);
        vibOsc_.reset();
    }

    void triggerAttack(bool /*doPortamento*/) { // TODO: why is doPortamento not used?
        std::vector<size_t> randVec(numOscillators_);
        std::iota(randVec.begin(), randVec.end(), 0);
        std::shuffle(randVec.begin(), randVec.end(), std::default_random_engine(0)); // TODO(argit): have a seed

        for (size_t i = 0; i < convert::double_to_sizet(numOscillators_); ++i) {
            auto& osc           = oscArray_[randVec[i]];
            osc.env_.delayTime_ = math::map0to1<double>(random_.runUnipolar() * curve::Rational{ -0.5 }.get(oscArray_[i].div_), delayMin_, delayMax_);

            osc.env_.attackTime_ = math::map0to1<double>(random_.runUnipolar(), attackMin_, attackMax_);
            osc.env_.attackTimeChanged();

            osc.env_.releaseTime_ = math::map0to1<double>(random_.runUnipolar(), releaseMin_, releaseMax_);
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

        size_t i{};
        if (!oscArray_[0].env_.isIdle()) {
            // oscArray_[0].osc_.calculateState(); // for DSF
            out[0]  = oscArray_[0].run() * ampForCenter;
            out[1]  = out[0];
            isIdle_ = false;
            i       = 1;
        }
        if (math::isEven(convert::double_to_sizet(numOscillators_))) {
            if (!oscArray_[1].env_.isIdle()) {
                // oscArray_[1].osc_.calculateState(); // for DSF
                out[1]  = oscArray_[1].run() * ampForCenter;
                isIdle_ = false;
            }
            i = 2;
        }

        int ch = 0;
        for (; i < convert::double_to_sizet(numOscillators_); ++i) {
            if (!oscArray_[i].env_.isIdle()) {
                // oscArray_[i].osc_.calculateState(); // for DSF
                out[ch % numChannels_] += oscArray_[i].run() * ampForSides;
                ++ch;
                isIdle_ = false;
            }
        }

        double velocityMult = math::valFromVelocityAndSensitivity(velocity_, velocitySensitivity_);
        out[0] *= velocityMult;
        out[1] *= velocityMult;

        vibOsc_.run();

        return out;
    }

    int prevNumOscillators_{ 0 };

    std::array<HypersawUnit, numOscillatorsMax_> oscArray_;
    random::LCG64 random_;
    bool isIdle_{};

    void oscResetRanged(int startIdx, int endIdx) {
        for (int i = startIdx; i < endIdx; ++i) {
            if (oscArray_[i].env_.isIdle() || (!oscArray_[i].env_.isIdle() && convert::double_to_int(phaseResetMode_) == 2)) {
                oscArray_[i].osc_.reset();
                oscArray_[i].drift_.out_ = 0;
                oscArray_[i].drift_.lpf_.reset();
                oscArray_[i].randomizePhase();
            }
        }
    }

  private:
    static void getCenterSideAmplitudeValue(double value, double* center, double* side) {
        *center = std::min(2.0 - value * 2.0, 1.0);
        *side   = std::min(value * 2.0, 1.0);
    }
};
} // namespace soemdsp::oscillator
