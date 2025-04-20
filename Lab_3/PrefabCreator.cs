using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

public class PrefabCreator : MonoBehaviour
{
    [SerializeField] private GameObject groundPrefab;
    [SerializeField] private GameObject propelledControllerPrefab;

    [SerializeField] private Vector3 groundOffset;
    [SerializeField] private Vector3 propelledControllerOffset;

    [SerializeField] private Quaternion groundRotation;
    [SerializeField] private Quaternion propelledControllerRotation;

    private ARTrackedImageManager arTrackedImageManager;
    private Dictionary<TrackableId, List<GameObject>> spawnedObjects = new();

    private void Awake()
    {
        arTrackedImageManager = GetComponent<ARTrackedImageManager>();
    }

    private void OnEnable()
    {
        if (arTrackedImageManager != null)
        {
            arTrackedImageManager.trackablesChanged.AddListener(OnTrackablesChanged);
        }
    }

    private void OnDisable()
    {
        if (arTrackedImageManager != null)
        {
            arTrackedImageManager.trackablesChanged.RemoveListener(OnTrackablesChanged);
        }
    }

    private void OnTrackablesChanged(ARTrackablesChangedEventArgs<ARTrackedImage> eventArgs)
    {
        foreach (ARTrackedImage image in eventArgs.added)
        {
            CreatePrefabs(image);
        }

        foreach (ARTrackedImage image in eventArgs.updated)
        {
            UpdatePrefabsPosition(image);
        }
    }

    private void CreatePrefabs(ARTrackedImage image)
    {
        if (!spawnedObjects.ContainsKey(image.trackableId))
        {
            spawnedObjects[image.trackableId] = new List<GameObject>();
        }

        GameObject ground = Instantiate(groundPrefab, image.transform.position + groundOffset, groundRotation);
        ground.transform.SetParent(image.transform);
        spawnedObjects[image.trackableId].Add(ground);

        GameObject propelledController = Instantiate(propelledControllerPrefab, image.transform.position + propelledControllerOffset, propelledControllerRotation);
        propelledController.transform.SetParent(image.transform);
        spawnedObjects[image.trackableId].Add(propelledController);
    }

    private void UpdatePrefabsPosition(ARTrackedImage image)
    {
        if (spawnedObjects.TryGetValue(image.trackableId, out List<GameObject> existingObjects))
        {
            if (existingObjects.Count > 0)
            {
                existingObjects[0].transform.position = image.transform.position + groundOffset;
                existingObjects[0].transform.rotation = groundRotation;
            }
            if (existingObjects.Count > 1)
            {
                existingObjects[1].transform.position = image.transform.position + propelledControllerOffset;
                existingObjects[1].transform.rotation = propelledControllerRotation;
            }
        }
    }
}