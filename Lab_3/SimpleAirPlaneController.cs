using UnityEngine;
using System.Collections.Generic;
using System;

namespace HeneGames.Airplane
{
    [RequireComponent(typeof(Rigidbody))]
    public class SimpleAirPlaneController : MonoBehaviour
    {
        public enum AirplaneState
        {
            Ground,
            Takeoff,
            Flying,
            Landing
        }

        public Action crashAction;

        #region Private variables

        private List<SimpleAirPlaneCollider> airPlaneColliders = new List<SimpleAirPlaneCollider>();
        private float maxSpeed = 0.6f;
        private float speedMultiplier;
        private float currentYawSpeed;
        private float currentPitchSpeed;
        private float currentRollSpeed;
        private float currentSpeed;
        private float currentEngineLightIntensity;
        private float currentEngineSoundPitch;
        private float lastEngineSpeed;
        private bool planeIsDead;
        private Rigidbody rb;
        private Runway currentRunway;
        private bool takeoffTriggered;

        private float inputH;
        private float inputV;
        private bool inputTurbo;
        private bool inputYawLeft;
        private bool inputYawRight;
        private bool inputTakeoff;
        private bool inputLand;

        private Vector3 initialLocalPosition; // Початкова локальна позиція відносно маркера
        private Vector3 relativePosition; // Відносна позиція для руху

        #endregion

        public AirplaneState airplaneState = AirplaneState.Ground;

        [Header("Joystick Settings")]
        [SerializeField] private FixedJoystick joystick;

        [Header("UI Settings")]
        [SerializeField] private UnityEngine.UI.Button takeoffButton;
        [SerializeField] private UnityEngine.UI.Button landButton;

        [Header("Wing trail effects")]
        [Range(0.01f, 1f)]
        [SerializeField] private float trailThickness = 0.045f;
        [SerializeField] private TrailRenderer[] wingTrailEffects;

        [Header("Rotating speeds")]
        [Range(5f, 500f)]
        [SerializeField] private float yawSpeed = 50f;
        [Range(5f, 500f)]
        [SerializeField] private float pitchSpeed = 100f;
        [Range(5f, 500f)]
        [SerializeField] private float rollSpeed = 200f;

        [Header("Rotating speeds multiplers when turbo is used")]
        [Range(0.1f, 5f)]
        [SerializeField] private float yawTurboMultiplier = 0.3f;
        [Range(0.1f, 5f)]
        [SerializeField] private float pitchTurboMultiplier = 0.5f;
        [Range(0.1f, 5f)]
        [SerializeField] private float rollTurboMultiplier = 1f;

        [Header("Moving speed")]
        [Range(5f, 100f)]
        [SerializeField] private float defaultSpeed = 10f;
        [Range(10f, 200f)]
        [SerializeField] private float turboSpeed = 20f;
        [Range(0.1f, 50f)]
        [SerializeField] private float accelerating = 10f;
        [Range(0.1f, 50f)]
        [SerializeField] private float deaccelerating = 5f;

        [Header("Turbo settings")]
        [Range(0f, 100f)]
        [SerializeField] private float turboHeatingSpeed;
        [Range(0f, 100f)]
        [SerializeField] private float turboCooldownSpeed;

        [Header("Turbo heat values")]
        [Range(0f, 100f)]
        [SerializeField] private float turboHeat;
        [Range(0f, 100f)]
        [SerializeField] private float turboOverheatOver;
        [SerializeField] private bool turboOverheat;

        [Header("Sideway force")]
        [Range(0.1f, 15f)]
        [SerializeField] private float sidewaysMovement = 15f;
        [Range(0.001f, 0.05f)]
        [SerializeField] private float sidewaysMovementXRot = 0.012f;
        [Range(0.1f, 5f)]
        [SerializeField] private float sidewaysMovementYRot = 1.5f;
        [Range(-1, 1f)]
        [SerializeField] private float sidewaysMovementYPos = 0.1f;

        [Header("Engine sound settings")]
        [SerializeField] private AudioSource engineSoundSource;
        [SerializeField] private float maxEngineSound = 1f;
        [SerializeField] private float defaultSoundPitch = 1f;
        [SerializeField] private float turboSoundPitch = 1.5f;

        [Header("Engine propellers settings")]
        [Range(10f, 10000f)]
        [SerializeField] private float propelSpeedMultiplier = 100f;
        [SerializeField] private GameObject[] propellers;

        [Header("Turbine light settings")]
        [Range(0.1f, 20f)]
        [SerializeField] private float turbineLightDefault = 1f;
        [Range(0.1f, 20f)]
        [SerializeField] private float turbineLightTurbo = 5f;
        [SerializeField] private Light[] turbineLights;

        [Header("Colliders")]
        [SerializeField] private Transform crashCollidersRoot;

        [Header("Takeoff settings")]
        [SerializeField] private float takeoffLenght = 30f;

        private void Start()
        {
            maxSpeed = defaultSpeed;
            currentSpeed = 0f;
            ChangeSpeedMultiplier(1f);
            rb = GetComponent<Rigidbody>();
            rb.isKinematic = true;
            rb.useGravity = false;
            rb.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;
            SetupColliders(crashCollidersRoot);

            initialLocalPosition = transform.localPosition;
            relativePosition = Vector3.zero; // Ініціалізація відносної позиції

            if (takeoffButton != null)
                takeoffButton.onClick.AddListener(() => { inputTakeoff = true; Debug.Log("Takeoff button pressed"); });
            else
                Debug.LogWarning("Takeoff Button not assigned on " + gameObject.name);

            if (landButton != null)
                landButton.onClick.AddListener(() => { inputLand = true; Debug.Log("Land button pressed"); });
            else
                Debug.LogWarning("Land Button not assigned on " + gameObject.name);

            if (joystick == null)
            {
                joystick = FindObjectOfType<FixedJoystick>();
                if (joystick == null)
                {
                    Debug.LogWarning("Joystick not found in the scene for SimpleAirPlaneController on " + gameObject.name);
                }
            }

            if (propellers == null) propellers = new GameObject[0];
            if (turbineLights == null) turbineLights = new Light[0];
            if (wingTrailEffects == null) wingTrailEffects = new TrailRenderer[0];
            if (engineSoundSource == null)
            {
                engineSoundSource = GetComponent<AudioSource>();
                if (engineSoundSource == null)
                {
                    Debug.LogWarning("Engine Sound Source not found on " + gameObject.name + ". Audio will not play.");
                }
            }

            Debug.Log($"Initial Local Position: {initialLocalPosition}, Propellers Count: {propellers.Length}");
        }

        private void Update()
        {
            AudioSystem();
            HandleInputs();
            Debug.Log($"Airplane State: {airplaneState}, Current Speed: {currentSpeed}, Relative Position: {relativePosition}, Local Position: {transform.localPosition}, Global Position: {transform.position}, Parent: {(transform.parent != null ? transform.parent.name : "None")}");

            switch (airplaneState)
            {
                case AirplaneState.Ground:
                    GroundUpdate();
                    break;
                case AirplaneState.Takeoff:
                    TakeoffUpdate();
                    break;
                case AirplaneState.Flying:
                    FlyingUpdate();
                    break;
                case AirplaneState.Landing:
                    LandingUpdate();
                    break;
            }
        }

        #region Ground State
        private void GroundUpdate()
        {
            UpdatePropellersAndLights();
            currentSpeed = 0f;
            ChangeWingTrailEffectThickness(0f);

            if (inputTakeoff)
            {
                Debug.Log("Takeoff initiated");
                airplaneState = AirplaneState.Takeoff;
                takeoffTriggered = true;
                inputTakeoff = false;
            }
        }
        #endregion

        #region Flying State
        private void FlyingUpdate()
        {
            UpdatePropellersAndLights();
            if (!planeIsDead)
            {
                Movement();
                SidewaysForceCalculation();
            }
            else
            {
                ChangeWingTrailEffectThickness(0f);
            }

            if (inputLand)
            {
                Debug.Log("Landing initiated");
                airplaneState = AirplaneState.Landing;
                inputLand = false;
            }

            if (!planeIsDead && HitSometing())
            {
                Crash();
            }
        }

        private void SidewaysForceCalculation()
        {
            float _mutiplierXRot = sidewaysMovement * sidewaysMovementXRot;
            float _mutiplierYRot = sidewaysMovement * sidewaysMovementYRot;
            float _mutiplierYPos = sidewaysMovement * sidewaysMovementYPos;

            if (transform.localEulerAngles.z > 270f && transform.localEulerAngles.z < 360f)
            {
                float _angle = (transform.localEulerAngles.z - 270f) / (360f - 270f);
                float _invert = 1f - _angle;
                transform.Rotate(Vector3.up * (_invert * _mutiplierYRot) * Time.deltaTime, Space.Self);
                transform.Rotate(Vector3.right * (-_invert * _mutiplierXRot) * currentPitchSpeed * Time.deltaTime, Space.Self);
                relativePosition += transform.up * (_invert * _mutiplierYPos) * Time.deltaTime;
            }
            if (transform.localEulerAngles.z > 0f && transform.localEulerAngles.z < 90f)
            {
                float _angle = transform.localEulerAngles.z / 90f;
                transform.Rotate(-Vector3.up * (_angle * _mutiplierYRot) * Time.deltaTime, Space.Self);
                transform.Rotate(Vector3.right * (-_angle * _mutiplierXRot) * currentPitchSpeed * Time.deltaTime, Space.Self);
                relativePosition += transform.up * (_angle * _mutiplierYPos) * Time.deltaTime;
            }
            if (transform.localEulerAngles.z > 90f && transform.localEulerAngles.z < 180f)
            {
                float _angle = (transform.localEulerAngles.z - 90f) / (180f - 90f);
                float _invert = 1f - _angle;
                relativePosition += transform.up * (_invert * _mutiplierYPos) * Time.deltaTime;
                transform.Rotate(Vector3.right * (-_invert * _mutiplierXRot) * currentPitchSpeed * Time.deltaTime, Space.Self);
            }
            if (transform.localEulerAngles.z > 180f && transform.localEulerAngles.z < 270f)
            {
                float _angle = (transform.localEulerAngles.z - 180f) / (270f - 180f);
                relativePosition += transform.up * (_angle * _mutiplierYPos) * Time.deltaTime;
                transform.Rotate(Vector3.right * (-_angle * _mutiplierXRot) * currentPitchSpeed * Time.deltaTime, Space.Self);
            }
        }

        private void Movement()
        {
            float maxDistance = 0.5f;

            // Рух у локальному просторі з урахуванням джойстика
            Vector3 moveDirection = Vector3.forward * (inputV * currentSpeed * Time.deltaTime);
            moveDirection += Vector3.right * (inputH * currentSpeed * Time.deltaTime);
            relativePosition += moveDirection;

            // Обмеження руху в межах маркера
            if (relativePosition.magnitude > maxDistance)
            {
                relativePosition = relativePosition.normalized * maxDistance;
            }
            transform.localPosition = initialLocalPosition + relativePosition;

            lastEngineSpeed = currentSpeed;

            // Поворот літака на основі джойстика
            if (inputH != 0 || inputV != 0)
            {
                float targetYaw = Mathf.Atan2(inputH, inputV) * Mathf.Rad2Deg;
                transform.localRotation = Quaternion.Euler(transform.localEulerAngles.x, targetYaw, transform.localEulerAngles.z);
            }

            // Додаткові повороти для авіаційної механіки
            transform.Rotate(Vector3.forward * -inputH * currentRollSpeed * Time.deltaTime, Space.Self);
            transform.Rotate(Vector3.right * inputV * currentPitchSpeed * Time.deltaTime, Space.Self);

            if (inputYawRight)
                transform.Rotate(Vector3.up * currentYawSpeed * Time.deltaTime, Space.Self);
            else if (inputYawLeft)
                transform.Rotate(-Vector3.up * currentYawSpeed * Time.deltaTime, Space.Self);

            if (currentSpeed < maxSpeed)
                currentSpeed += accelerating * Time.deltaTime;
            else
                currentSpeed -= deaccelerating * Time.deltaTime;

            if (inputTurbo && !turboOverheat)
            {
                if (turboHeat > 100f)
                {
                    turboHeat = 100f;
                    turboOverheat = true;
                }
                else
                {
                    turboHeat += Time.deltaTime * turboHeatingSpeed;
                }
                maxSpeed = turboSpeed;
                currentYawSpeed = yawSpeed * yawTurboMultiplier;
                currentPitchSpeed = pitchSpeed * pitchTurboMultiplier;
                currentRollSpeed = rollSpeed * rollTurboMultiplier;
                currentEngineLightIntensity = turbineLightTurbo;
                ChangeWingTrailEffectThickness(trailThickness);
                currentEngineSoundPitch = turboSoundPitch;
            }
            else
            {
                if (turboHeat > 0f)
                    turboHeat -= Time.deltaTime * turboCooldownSpeed;
                else
                    turboHeat = 0f;

                if (turboOverheat && turboHeat <= turboOverheatOver)
                    turboOverheat = false;

                maxSpeed = defaultSpeed * speedMultiplier;
                currentYawSpeed = yawSpeed;
                currentPitchSpeed = pitchSpeed;
                currentRollSpeed = rollSpeed;
                currentEngineLightIntensity = turbineLightDefault;
                ChangeWingTrailEffectThickness(0f);
                currentEngineSoundPitch = defaultSoundPitch;
            }
        }
        #endregion

        #region Landing State
        public void AddLandingRunway(Runway _landingThisRunway)
        {
            currentRunway = _landingThisRunway;
        }

        private void LandingUpdate()
        {
            UpdatePropellersAndLights();
            ChangeWingTrailEffectThickness(0f);
            currentSpeed = Mathf.Lerp(currentSpeed, 0f, Time.deltaTime);
            transform.localRotation = Quaternion.Lerp(transform.localRotation, Quaternion.Euler(0f, transform.localEulerAngles.y, 0f), 2f * Time.deltaTime);

            if (currentSpeed < 0.1f)
            {
                Debug.Log("Landing completed, returning to Ground state");
                airplaneState = AirplaneState.Ground;
                currentRunway = null;
                relativePosition = Vector3.zero;
                transform.localPosition = initialLocalPosition;
            }
        }
        #endregion

        #region Takeoff State
        private void TakeoffUpdate()
        {
            UpdatePropellersAndLights();
            foreach (SimpleAirPlaneCollider _airPlaneCollider in airPlaneColliders)
                _airPlaneCollider.collideSometing = false;

            if (currentSpeed < turboSpeed)
            {
                currentSpeed += (accelerating * 2f) * Time.deltaTime;
                Debug.Log($"Increasing speed during takeoff: {currentSpeed}");
            }

            // Рух вперед і вгору для зльоту
            Vector3 moveDirection = Vector3.forward * (currentSpeed * Time.deltaTime);
            moveDirection += Vector3.up * (currentSpeed * 0.1f * Time.deltaTime);
            relativePosition += moveDirection;

            float maxDistance = 0.5f;
            if (relativePosition.magnitude > maxDistance)
            {
                relativePosition = relativePosition.normalized * maxDistance;
            }
            transform.localPosition = initialLocalPosition + relativePosition;

            if (currentSpeed >= defaultSpeed)
            {
                Debug.Log("Takeoff completed, entering Flying state");
                airplaneState = AirplaneState.Flying;
                takeoffTriggered = false;
            }
        }
        #endregion

        #region Audio
        private void AudioSystem()
        {
            if (engineSoundSource == null)
                return;

            if (airplaneState == AirplaneState.Flying || airplaneState == AirplaneState.Takeoff)
            {
                if (engineSoundSource != null)
                {
                    engineSoundSource.pitch = Mathf.Lerp(engineSoundSource.pitch, currentEngineSoundPitch, 10f * Time.deltaTime);
                    engineSoundSource.volume = Mathf.Lerp(engineSoundSource.volume, maxEngineSound, 1f * Time.deltaTime);
                }
            }
            else if (airplaneState == AirplaneState.Landing || airplaneState == AirplaneState.Ground)
            {
                if (engineSoundSource != null)
                {
                    engineSoundSource.pitch = Mathf.Lerp(engineSoundSource.pitch, defaultSoundPitch, 1f * Time.deltaTime);
                    engineSoundSource.volume = Mathf.Lerp(engineSoundSource.volume, 0f, 1f * Time.deltaTime);
                }
            }
        }
        #endregion

        #region Private methods
        private void UpdatePropellersAndLights()
        {
            if (!planeIsDead)
            {
                if (propellers.Length > 0)
                {
                    float propellerSpeed = (airplaneState == AirplaneState.Takeoff || airplaneState == AirplaneState.Flying) ? propelSpeedMultiplier : 0f;
                    RotatePropellers(propellers, propellerSpeed);
                    Debug.Log($"Propellers rotating at speed: {propellerSpeed}, Propellers count: {propellers.Length}");
                }
                if (turbineLights.Length > 0)
                    ControlEngineLights(turbineLights, currentEngineLightIntensity);
            }
            else
            {
                if (propellers.Length > 0)
                    RotatePropellers(propellers, 0f);
                if (turbineLights.Length > 0)
                    ControlEngineLights(turbineLights, 0f);
            }
        }

        private void SetupColliders(Transform _root)
        {
            if (_root == null)
                return;

            Collider[] colliders = _root.GetComponentsInChildren<Collider>();
            for (int i = 0; i < colliders.Length; i++)
            {
                colliders[i].isTrigger = true;
                GameObject _currentObject = colliders[i].gameObject;
                SimpleAirPlaneCollider _airplaneCollider = _currentObject.AddComponent<SimpleAirPlaneCollider>();
                airPlaneColliders.Add(_airplaneCollider);
                _airplaneCollider.controller = this;
                Rigidbody _rb = _currentObject.AddComponent<Rigidbody>();
                _rb.useGravity = false;
                _rb.isKinematic = true;
                _rb.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;
            }
        }

        private void RotatePropellers(GameObject[] _rotateThese, float _speed)
        {
            for (int i = 0; i < _rotateThese.Length; i++)
            {
                if (_rotateThese[i] != null)
                    _rotateThese[i].transform.Rotate(Vector3.forward * -_speed * Time.deltaTime, Space.Self);
                else
                    Debug.LogWarning($"Propeller element {i} is null");
            }
        }

        private void ControlEngineLights(Light[] _lights, float _intensity)
        {
            for (int i = 0; i < _lights.Length; i++)
            {
                if (_lights[i] != null)
                    _lights[i].intensity = Mathf.Lerp(_lights[i].intensity, planeIsDead ? 0f : _intensity, 10f * Time.deltaTime);
            }
        }

        private void ChangeWingTrailEffectThickness(float _thickness)
        {
            for (int i = 0; i < wingTrailEffects.Length; i++)
            {
                if (wingTrailEffects[i] != null)
                    wingTrailEffects[i].startWidth = Mathf.Lerp(wingTrailEffects[i].startWidth, _thickness, Time.deltaTime * 10f);
            }
        }

        private bool HitSometing()
        {
            for (int i = 0; i < airPlaneColliders.Count; i++)
            {
                if (airPlaneColliders[i].collideSometing)
                {
                    foreach (SimpleAirPlaneCollider _airPlaneCollider in airPlaneColliders)
                        _airPlaneCollider.collideSometing = false;
                    return true;
                }
            }
            return false;
        }
        #endregion

        #region Public methods
        public virtual void Crash()
        {
            crashAction?.Invoke();
            rb.isKinematic = false;
            rb.useGravity = true;
            rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            rb.AddForce(transform.forward * lastEngineSpeed, ForceMode.VelocityChange);
            for (int i = 0; i < airPlaneColliders.Count; i++)
            {
                airPlaneColliders[i].GetComponent<Collider>().isTrigger = false;
                Destroy(airPlaneColliders[i].GetComponent<Rigidbody>());
            }
            planeIsDead = true;
        }
        #endregion

        #region Variables
        public float PercentToMaxSpeed()
        {
            return (currentSpeed * speedMultiplier) / turboSpeed;
        }

        public bool PlaneIsDead()
        {
            return planeIsDead;
        }

        public bool UsingTurbo()
        {
            return maxSpeed == turboSpeed;
        }

        public float CurrentSpeed()
        {
            return currentSpeed * speedMultiplier;
        }

        public float TurboHeatValue()
        {
            return turboHeat;
        }

        public bool TurboOverheating()
        {
            return turboOverheat;
        }

        public void ChangeSpeedMultiplier(float _speedMultiplier)
        {
            _speedMultiplier = Mathf.Clamp(_speedMultiplier, 0f, 1f);
            speedMultiplier = _speedMultiplier;
        }
        #endregion

        #region Inputs
        private void HandleInputs()
        {
            if (joystick != null)
            {
                inputH = joystick.Horizontal;
                inputV = joystick.Vertical;
                inputYawLeft = joystick.Horizontal < -0.5f;
                inputYawRight = joystick.Horizontal > 0.5f;
                inputTurbo = joystick.Vertical > 0.8f;
                Debug.Log($"Joystick Input: Horizontal = {inputH}, Vertical = {inputV}");
            }
            else
            {
                inputH = 0f;
                inputV = 0f;
                inputYawLeft = false;
                inputYawRight = false;
                inputTurbo = false;
            }
        }
        #endregion
    }
}

// using UnityEngine;
// using System.Collections.Generic;
// using System;

// namespace HeneGames.Airplane
// {
//     [RequireComponent(typeof(Rigidbody))]
//     public class SimpleAirPlaneController : MonoBehaviour
//     {
//         public enum AirplaneState
//         {
//             Ground,
//             Takeoff,
//             Flying,
//             Landing
//         }

//         public Action crashAction;

//         #region Private variables

//         private List<SimpleAirPlaneCollider> airPlaneColliders = new List<SimpleAirPlaneCollider>();
//         private float maxSpeed = 0.6f;
//         private float speedMultiplier;
//         private float currentYawSpeed;
//         private float currentPitchSpeed;
//         private float currentRollSpeed;
//         private float currentSpeed;
//         private float currentEngineLightIntensity;
//         private float currentEngineSoundPitch;
//         private float lastEngineSpeed;
//         private bool planeIsDead;
//         private Rigidbody rb;
//         private Runway currentRunway;
//         private bool takeoffTriggered;

//         private float inputH;
//         private float inputV;
//         private bool inputTurbo;
//         private bool inputYawLeft;
//         private bool inputYawRight;
//         private bool inputTakeoff;
//         private bool inputLand;

//         #endregion

//         public AirplaneState airplaneState = AirplaneState.Ground;

//         [Header("Joystick Settings")]
//         [SerializeField] private FixedJoystick joystick;

//         [Header("UI Settings")]
//         [SerializeField] private UnityEngine.UI.Button takeoffButton;
//         [SerializeField] private UnityEngine.UI.Button landButton;

//         [Header("Wing trail effects")]
//         [Range(0.01f, 1f)]
//         [SerializeField] private float trailThickness = 0.045f;
//         [SerializeField] private TrailRenderer[] wingTrailEffects;

//         [Header("Rotating speeds")]
//         [Range(5f, 500f)]
//         [SerializeField] private float yawSpeed = 50f;
//         [Range(5f, 500f)]
//         [SerializeField] private float pitchSpeed = 100f;
//         [Range(5f, 500f)]
//         [SerializeField] private float rollSpeed = 200f;

//         [Header("Rotating speeds multiplers when turbo is used")]
//         [Range(0.1f, 5f)]
//         [SerializeField] private float yawTurboMultiplier = 0.3f;
//         [Range(0.1f, 5f)]
//         [SerializeField] private float pitchTurboMultiplier = 0.5f;
//         [Range(0.1f, 5f)]
//         [SerializeField] private float rollTurboMultiplier = 1f;

//         [Header("Moving speed")]
//         [Range(5f, 100f)]
//         [SerializeField] private float defaultSpeed = 10f;
//         [Range(10f, 200f)]
//         [SerializeField] private float turboSpeed = 20f;
//         [Range(0.1f, 50f)]
//         [SerializeField] private float accelerating = 10f;
//         [Range(0.1f, 50f)]
//         [SerializeField] private float deaccelerating = 5f;

//         [Header("Turbo settings")]
//         [Range(0f, 100f)]
//         [SerializeField] private float turboHeatingSpeed;
//         [Range(0f, 100f)]
//         [SerializeField] private float turboCooldownSpeed;

//         [Header("Turbo heat values")]
//         [Range(0f, 100f)]
//         [SerializeField] private float turboHeat;
//         [Range(0f, 100f)]
//         [SerializeField] private float turboOverheatOver;
//         [SerializeField] private bool turboOverheat;

//         [Header("Sideway force")]
//         [Range(0.1f, 15f)]
//         [SerializeField] private float sidewaysMovement = 15f;
//         [Range(0.001f, 0.05f)]
//         [SerializeField] private float sidewaysMovementXRot = 0.012f;
//         [Range(0.1f, 5f)]
//         [SerializeField] private float sidewaysMovementYRot = 1.5f;
//         [Range(-1, 1f)]
//         [SerializeField] private float sidewaysMovementYPos = 0.1f;

//         [Header("Engine sound settings")]
//         [SerializeField] private AudioSource engineSoundSource;
//         [SerializeField] private float maxEngineSound = 1f;
//         [SerializeField] private float defaultSoundPitch = 1f;
//         [SerializeField] private float turboSoundPitch = 1.5f;

//         [Header("Engine propellers settings")]
//         [Range(10f, 10000f)]
//         [SerializeField] private float propelSpeedMultiplier = 100f;
//         [SerializeField] private GameObject[] propellers;

//         [Header("Turbine light settings")]
//         [Range(0.1f, 20f)]
//         [SerializeField] private float turbineLightDefault = 1f;
//         [Range(0.1f, 20f)]
//         [SerializeField] private float turbineLightTurbo = 5f;
//         [SerializeField] private Light[] turbineLights;

//         [Header("Colliders")]
//         [SerializeField] private Transform crashCollidersRoot;

//         [Header("Takeoff settings")]
//         [SerializeField] private float takeoffLenght = 30f;

//         private void Start()
//         {
//             maxSpeed = defaultSpeed;
//             currentSpeed = 0f;
//             ChangeSpeedMultiplier(1f);
//             rb = GetComponent<Rigidbody>();
//             rb.isKinematic = true;
//             rb.useGravity = false;
//             rb.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;
//             SetupColliders(crashCollidersRoot);

//             if (takeoffButton != null)
//                 takeoffButton.onClick.AddListener(() => inputTakeoff = true);
//             else
//                 Debug.LogWarning("Takeoff Button not assigned on " + gameObject.name);

//             if (landButton != null)
//                 landButton.onClick.AddListener(() => inputLand = true);
//             else
//                 Debug.LogWarning("Land Button not assigned on " + gameObject.name);

//             if (joystick == null)
//             {
//                 joystick = FindObjectOfType<FixedJoystick>();
//                 if (joystick == null)
//                 {
//                     Debug.LogWarning("Joystick not found in the scene for SimpleAirPlaneController on " + gameObject.name);
//                 }
//             }

//             if (propellers == null) propellers = new GameObject[0];
//             if (turbineLights == null) turbineLights = new Light[0];
//             if (wingTrailEffects == null) wingTrailEffects = new TrailRenderer[0];
//             if (engineSoundSource == null)
//             {
//                 engineSoundSource = GetComponent<AudioSource>();
//                 if (engineSoundSource == null)
//                 {
//                     Debug.LogWarning("Engine Sound Source not found on " + gameObject.name + ". Audio will not play.");
//                 }
//             }
//         }

//         private void Update()
//         {
//             AudioSystem();
//             HandleInputs();
//             Debug.Log($"Airplane State: {airplaneState}, Current Speed: {currentSpeed}");

//             switch (airplaneState)
//             {
//                 case AirplaneState.Ground:
//                     GroundUpdate();
//                     break;
//                 case AirplaneState.Takeoff:
//                     TakeoffUpdate();
//                     break;
//                 case AirplaneState.Flying:
//                     FlyingUpdate();
//                     break;
//                 case AirplaneState.Landing:
//                     LandingUpdate();
//                     break;
//             }
//         }

//         #region Ground State
//         private void GroundUpdate()
//         {
//             UpdatePropellersAndLights();
//             currentSpeed = 0f;
//             ChangeWingTrailEffectThickness(0f);

//             if (inputTakeoff)
//             {
//                 Debug.Log("Takeoff initiated");
//                 airplaneState = AirplaneState.Takeoff;
//                 takeoffTriggered = true;
//                 inputTakeoff = false;
//             }
//         }
//         #endregion

//         #region Flying State
//         private void FlyingUpdate()
//         {
//             UpdatePropellersAndLights();
//             if (!planeIsDead)
//             {
//                 Movement();
//                 SidewaysForceCalculation();
//             }
//             else
//             {
//                 ChangeWingTrailEffectThickness(0f);
//             }

//             if (inputLand)
//             {
//                 Debug.Log("Landing initiated");
//                 airplaneState = AirplaneState.Landing;
//                 inputLand = false;
//             }

//             if (!planeIsDead && HitSometing())
//             {
//                 Crash();
//             }
//         }

//         private void SidewaysForceCalculation()
//         {
//             float _mutiplierXRot = sidewaysMovement * sidewaysMovementXRot;
//             float _mutiplierYRot = sidewaysMovement * sidewaysMovementYRot;
//             float _mutiplierYPos = sidewaysMovement * sidewaysMovementYPos;

//             if (transform.localEulerAngles.z > 270f && transform.localEulerAngles.z < 360f)
//             {
//                 float _angle = (transform.localEulerAngles.z - 270f) / (360f - 270f);
//                 float _invert = 1f - _angle;
//                 transform.Rotate(Vector3.up * (_invert * _mutiplierYRot) * Time.deltaTime);
//                 transform.Rotate(Vector3.right * (-_invert * _mutiplierXRot) * currentPitchSpeed * Time.deltaTime);
//                 transform.Translate(transform.up * (_invert * _mutiplierYPos) * Time.deltaTime);
//             }
//             if (transform.localEulerAngles.z > 0f && transform.localEulerAngles.z < 90f)
//             {
//                 float _angle = transform.localEulerAngles.z / 90f;
//                 transform.Rotate(-Vector3.up * (_angle * _mutiplierYRot) * Time.deltaTime);
//                 transform.Rotate(Vector3.right * (-_angle * _mutiplierXRot) * currentPitchSpeed * Time.deltaTime);
//                 transform.Translate(transform.up * (_angle * _mutiplierYPos) * Time.deltaTime);
//             }
//             if (transform.localEulerAngles.z > 90f && transform.localEulerAngles.z < 180f)
//             {
//                 float _angle = (transform.localEulerAngles.z - 90f) / (180f - 90f);
//                 float _invert = 1f - _angle;
//                 transform.Translate(transform.up * (_invert * _mutiplierYPos) * Time.deltaTime);
//                 transform.Rotate(Vector3.right * (-_invert * _mutiplierXRot) * currentPitchSpeed * Time.deltaTime);
//             }
//             if (transform.localEulerAngles.z > 180f && transform.localEulerAngles.z < 270f)
//             {
//                 float _angle = (transform.localEulerAngles.z - 180f) / (270f - 180f);
//                 transform.Translate(transform.up * (_angle * _mutiplierYPos) * Time.deltaTime);
//                 transform.Rotate(Vector3.right * (-_angle * _mutiplierXRot) * currentPitchSpeed * Time.deltaTime);
//             }
//         }

//         private void Movement()
//         {
//             float maxDistance = 0.5f;
//             // Рух у напрямку, куди спрямований літак, з урахуванням джойстика
//             Vector3 moveDirection = transform.forward * (inputV * currentSpeed * Time.deltaTime);
//             moveDirection += transform.right * (inputH * currentSpeed * Time.deltaTime);
//             Vector3 newPosition = transform.localPosition + moveDirection;
//             if (newPosition.magnitude > maxDistance)
//             {
//                 newPosition = newPosition.normalized * maxDistance;
//             }
//             transform.localPosition = newPosition;

//             lastEngineSpeed = currentSpeed;

//             // Поворот літака на основі джойстика
//             if (inputH != 0 || inputV != 0)
//             {
//                 float targetYaw = Mathf.Atan2(inputH, inputV) * Mathf.Rad2Deg;
//                 transform.localRotation = Quaternion.Euler(transform.localEulerAngles.x, targetYaw, transform.localEulerAngles.z);
//             }

//             // Додаткові повороти для авіаційної механіки
//             transform.Rotate(Vector3.forward * -inputH * currentRollSpeed * Time.deltaTime);
//             transform.Rotate(Vector3.right * inputV * currentPitchSpeed * Time.deltaTime);

//             if (inputYawRight)
//                 transform.Rotate(Vector3.up * currentYawSpeed * Time.deltaTime);
//             else if (inputYawLeft)
//                 transform.Rotate(-Vector3.up * currentYawSpeed * Time.deltaTime);

//             if (currentSpeed < maxSpeed)
//                 currentSpeed += accelerating * Time.deltaTime;
//             else
//                 currentSpeed -= deaccelerating * Time.deltaTime;

//             if (inputTurbo && !turboOverheat)
//             {
//                 if (turboHeat > 100f)
//                 {
//                     turboHeat = 100f;
//                     turboOverheat = true;
//                 }
//                 else
//                 {
//                     turboHeat += Time.deltaTime * turboHeatingSpeed;
//                 }
//                 maxSpeed = turboSpeed;
//                 currentYawSpeed = yawSpeed * yawTurboMultiplier;
//                 currentPitchSpeed = pitchSpeed * pitchTurboMultiplier;
//                 currentRollSpeed = rollSpeed * rollTurboMultiplier;
//                 currentEngineLightIntensity = turbineLightTurbo;
//                 ChangeWingTrailEffectThickness(trailThickness);
//                 currentEngineSoundPitch = turboSoundPitch;
//             }
//             else
//             {
//                 if (turboHeat > 0f)
//                     turboHeat -= Time.deltaTime * turboCooldownSpeed;
//                 else
//                     turboHeat = 0f;

//                 if (turboOverheat && turboHeat <= turboOverheatOver)
//                     turboOverheat = false;

//                 maxSpeed = defaultSpeed * speedMultiplier;
//                 currentYawSpeed = yawSpeed;
//                 currentPitchSpeed = pitchSpeed;
//                 currentRollSpeed = rollSpeed;
//                 currentEngineLightIntensity = turbineLightDefault;
//                 ChangeWingTrailEffectThickness(0f);
//                 currentEngineSoundPitch = defaultSoundPitch;
//             }
//         }
//         #endregion

//         #region Landing State
//         public void AddLandingRunway(Runway _landingThisRunway)
//         {
//             currentRunway = _landingThisRunway;
//         }

//         private void LandingUpdate()
//         {
//             UpdatePropellersAndLights();
//             ChangeWingTrailEffectThickness(0f);
//             currentSpeed = Mathf.Lerp(currentSpeed, 0f, Time.deltaTime);
//             transform.localRotation = Quaternion.Lerp(transform.localRotation, Quaternion.Euler(0f, transform.localEulerAngles.y, 0f), 2f * Time.deltaTime);

//             if (currentSpeed < 0.1f)
//             {
//                 Debug.Log("Landing completed, returning to Ground state");
//                 airplaneState = AirplaneState.Ground;
//                 currentRunway = null;
//             }
//         }
//         #endregion

//         #region Takeoff State
//         private void TakeoffUpdate()
//         {
//             UpdatePropellersAndLights();
//             foreach (SimpleAirPlaneCollider _airPlaneCollider in airPlaneColliders)
//                 _airPlaneCollider.collideSometing = false;

//             if (currentSpeed < turboSpeed)
//                 currentSpeed += (accelerating * 2f) * Time.deltaTime;

//             // Рух вперед і вгору для зльоту
//             Vector3 moveDirection = transform.forward * (currentSpeed * Time.deltaTime);
//             moveDirection += transform.up * (currentSpeed * 0.1f * Time.deltaTime); // Підйом вгору
//             Vector3 newPosition = transform.localPosition + moveDirection;
//             float maxDistance = 0.5f;
//             if (newPosition.magnitude > maxDistance)
//             {
//                 newPosition = newPosition.normalized * maxDistance;
//             }
//             transform.localPosition = newPosition;

//             if (currentSpeed >= defaultSpeed)
//             {
//                 Debug.Log("Takeoff completed, entering Flying state");
//                 airplaneState = AirplaneState.Flying;
//                 takeoffTriggered = false;
//             }
//         }
//         #endregion

//         #region Audio
//         private void AudioSystem()
//         {
//             if (engineSoundSource == null)
//                 return;

//             if (airplaneState == AirplaneState.Flying || airplaneState == AirplaneState.Takeoff)
//             {
//                 if (engineSoundSource != null)
//                 {
//                     engineSoundSource.pitch = Mathf.Lerp(engineSoundSource.pitch, currentEngineSoundPitch, 10f * Time.deltaTime);
//                     engineSoundSource.volume = Mathf.Lerp(engineSoundSource.volume, maxEngineSound, 1f * Time.deltaTime);
//                 }
//             }
//             else if (airplaneState == AirplaneState.Landing || airplaneState == AirplaneState.Ground)
//             {
//                 if (engineSoundSource != null)
//                 {
//                     engineSoundSource.pitch = Mathf.Lerp(engineSoundSource.pitch, defaultSoundPitch, 1f * Time.deltaTime);
//                     engineSoundSource.volume = Mathf.Lerp(engineSoundSource.volume, 0f, 1f * Time.deltaTime);
//                 }
//             }
//         }
//         #endregion

//         #region Private methods
//         private void UpdatePropellersAndLights()
//         {
//             if (!planeIsDead)
//             {
//                 if (propellers.Length > 0)
//                 {
//                     // Обертання пропелерів навіть при currentSpeed = 0, якщо літак у стані Takeoff або Flying
//                     float propellerSpeed = (airplaneState == AirplaneState.Takeoff || airplaneState == AirplaneState.Flying) ? propelSpeedMultiplier : currentSpeed * propelSpeedMultiplier;
//                     RotatePropellers(propellers, propellerSpeed);
//                 }
//                 if (turbineLights.Length > 0)
//                     ControlEngineLights(turbineLights, currentEngineLightIntensity);
//             }
//             else
//             {
//                 if (propellers.Length > 0)
//                     RotatePropellers(propellers, 0f);
//                 if (turbineLights.Length > 0)
//                     ControlEngineLights(turbineLights, 0f);
//             }
//         }

//         private void SetupColliders(Transform _root)
//         {
//             if (_root == null)
//                 return;

//             Collider[] colliders = _root.GetComponentsInChildren<Collider>();
//             for (int i = 0; i < colliders.Length; i++)
//             {
//                 colliders[i].isTrigger = true;
//                 GameObject _currentObject = colliders[i].gameObject;
//                 SimpleAirPlaneCollider _airplaneCollider = _currentObject.AddComponent<SimpleAirPlaneCollider>();
//                 airPlaneColliders.Add(_airplaneCollider);
//                 _airplaneCollider.controller = this;
//                 Rigidbody _rb = _currentObject.AddComponent<Rigidbody>();
//                 _rb.useGravity = false;
//                 _rb.isKinematic = true;
//                 _rb.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;
//             }
//         }

//         private void RotatePropellers(GameObject[] _rotateThese, float _speed)
//         {
//             for (int i = 0; i < _rotateThese.Length; i++)
//             {
//                 if (_rotateThese[i] != null)
//                     _rotateThese[i].transform.Rotate(Vector3.forward * -_speed * Time.deltaTime);
//             }
//         }

//         private void ControlEngineLights(Light[] _lights, float _intensity)
//         {
//             for (int i = 0; i < _lights.Length; i++)
//             {
//                 if (_lights[i] != null)
//                     _lights[i].intensity = Mathf.Lerp(_lights[i].intensity, planeIsDead ? 0f : _intensity, 10f * Time.deltaTime);
//             }
//         }

//         private void ChangeWingTrailEffectThickness(float _thickness)
//         {
//             for (int i = 0; i < wingTrailEffects.Length; i++)
//             {
//                 if (wingTrailEffects[i] != null)
//                     wingTrailEffects[i].startWidth = Mathf.Lerp(wingTrailEffects[i].startWidth, _thickness, Time.deltaTime * 10f);
//             }
//         }

//         private bool HitSometing()
//         {
//             for (int i = 0; i < airPlaneColliders.Count; i++)
//             {
//                 if (airPlaneColliders[i].collideSometing)
//                 {
//                     foreach (SimpleAirPlaneCollider _airPlaneCollider in airPlaneColliders)
//                         _airPlaneCollider.collideSometing = false;
//                     return true;
//                 }
//             }
//             return false;
//         }
//         #endregion

//         #region Public methods
//         public virtual void Crash()
//         {
//             crashAction?.Invoke();
//             rb.isKinematic = false;
//             rb.useGravity = true;
//             rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
//             rb.AddForce(transform.forward * lastEngineSpeed, ForceMode.VelocityChange);
//             for (int i = 0; i < airPlaneColliders.Count; i++)
//             {
//                 airPlaneColliders[i].GetComponent<Collider>().isTrigger = false;
//                 Destroy(airPlaneColliders[i].GetComponent<Rigidbody>());
//             }
//             planeIsDead = true;
//         }
//         #endregion

//         #region Variables
//         public float PercentToMaxSpeed()
//         {
//             return (currentSpeed * speedMultiplier) / turboSpeed;
//         }

//         public bool PlaneIsDead()
//         {
//             return planeIsDead;
//         }

//         public bool UsingTurbo()
//         {
//             return maxSpeed == turboSpeed;
//         }

//         public float CurrentSpeed()
//         {
//             return currentSpeed * speedMultiplier;
//         }

//         public float TurboHeatValue()
//         {
//             return turboHeat;
//         }

//         public bool TurboOverheating()
//         {
//             return turboOverheat;
//         }

//         public void ChangeSpeedMultiplier(float _speedMultiplier)
//         {
//             _speedMultiplier = Mathf.Clamp(_speedMultiplier, 0f, 1f);
//             speedMultiplier = _speedMultiplier;
//         }
//         #endregion

//         #region Inputs
//         private void HandleInputs()
//         {
//             if (joystick != null)
//             {
//                 inputH = joystick.Horizontal;
//                 inputV = joystick.Vertical;
//                 inputYawLeft = joystick.Horizontal < -0.5f;
//                 inputYawRight = joystick.Horizontal > 0.5f;
//                 inputTurbo = joystick.Vertical > 0.8f;
//                 Debug.Log($"Joystick Input: Horizontal = {inputH}, Vertical = {inputV}");
//             }
//             else
//             {
//                 inputH = 0f;
//                 inputV = 0f;
//                 inputYawLeft = false;
//                 inputYawRight = false;
//                 inputTurbo = false;
//             }
//         }
//         #endregion
//     }
// }