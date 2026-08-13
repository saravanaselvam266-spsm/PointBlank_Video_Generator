import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [currentDoctor, setCurrentDoctor] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [selectedVoiceRecord, setSelectedVoiceRecord] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [script, setScript] = useState(
    "Hello and welcome to PointBlank Medical Center. Today we are sharing vital healthcare guidelines for preventative wellness and heart health. Regular checkups and balanced nutrition play a key role in long-term vitality. Please consult with our specialist team for personalized healthcare advice."
  );
  const [settings, setSettings] = useState({
    aspect_ratio: "16:9",
    captions: false,
    background_type: "color",
    background_value: "#FAFAFA",
    speed: 1.0
  });

  const [activeStep, setActiveStep] = useState(1); // Steps: 1: Doctor, 2: Avatar Scenario, 3: Voice, 4: Script, 5: Settings, 6: Preview, 7: Render
  const [activeVideo, setActiveVideo] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const resetStudio = () => {
    setActiveStep(1);
    setActiveVideo(null);
    setIsGenerating(false);
    setErrorMessage(null);
  };

  return (
    <AppContext.Provider
      value={{
        currentDoctor,
        setCurrentDoctor,
        selectedScenario,
        setSelectedScenario,
        selectedAvatar,
        setSelectedAvatar,
        selectedVoiceRecord,
        setSelectedVoiceRecord,
        selectedVoice,
        setSelectedVoice,
        script,
        setScript,
        settings,
        setSettings,
        activeStep,
        setActiveStep,
        activeVideo,
        setActiveVideo,
        isGenerating,
        setIsGenerating,
        errorMessage,
        setErrorMessage,
        resetStudio
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
