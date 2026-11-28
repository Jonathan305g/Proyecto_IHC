/**
 * Indicador de pasos visual y accesible para el asistente de planes de prueba.
 */
export default function WizardStepper({ currentStep, setStep, maxReachedStep }) {
  const steps = [
    { number: 1, title: 'Datos generales', subtitle: 'Información básica y alcance' },
    { number: 2, title: 'Tareas y criterios', subtitle: 'Consignas y métricas' },
    { number: 3, title: 'Revisar y guardar', subtitle: 'Confirmación y estado' },
  ]

  return (
    <nav aria-label="Pasos del asistente" className="wizard-container">
      <ol className="wizard-stepper">
        {steps.map((step) => {
          const isActive = currentStep === step.number
          const isCompleted = currentStep > step.number
          const canNavigate = step.number <= maxReachedStep

          return (
            <li key={step.number}>
              <button
                type="button"
                className={`stepper-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                disabled={!canNavigate}
                onClick={() => canNavigate && setStep(step.number)}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="stepper-number" aria-hidden="true">
                  {step.number}
                </span>
                <span className="stepper-label">
                  <strong>{step.title}</strong>
                  <small>{step.subtitle}</small>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
