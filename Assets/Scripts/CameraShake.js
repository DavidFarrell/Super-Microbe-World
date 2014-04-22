#pragma strict

public class CameraShake extends MonoBehaviour{
	
	private static var myGameObject: GameObject;
	private static var camComponent : Camera;
	
	private static var zoom : boolean = false;
	private static var OldSize: float;
	public static var secondsToZoom: float = 0.5;
	public static var zoomTo: float = 4;
	private static var currentZoom: float = 0;
	
	public static var shakeTime: float = 3.5;
	public static var shakeAmount : float = 0.2;
	
	function Start () {
		myGameObject = gameObject;
		camComponent = myGameObject.GetComponent(Camera);

	}

	function Update () {
		if (zoom){
			currentZoom += Time.deltaTime;
			camComponent.orthographicSize = Mathf.Lerp(OldSize, zoomTo, currentZoom / secondsToZoom);	//This way will linearly interpolate in real time from 0the old zoom to the new one in secondsToZoom seconds
			
		}
	}

	public static function ShrinkingZone(){
		if (camComponent){
			OldSize = camComponent.orthographicSize;
			currentZoom = 0;
			zoom = true;
			
			iTween.ShakePosition(myGameObject, Vector3(shakeAmount,shakeAmount,0), shakeTime);
		}
	}

}//End of class