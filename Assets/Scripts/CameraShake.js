#pragma strict

public class CameraShake extends MonoBehaviour{
	
	private static var myGameObject: GameObject;
	private static var camComponent : Camera;
	
	private static var zoom : boolean = false;
	private static var OldSize: float;
	private static var secondsToZoom: float = 0.5;
	private static var zoomTo: float = 4;
	private static var currentZoom: float = 0;
	
	private static var shakeTime: float = 3.5;
	private static var shakeAmount : float = 0.2;
	
	private static var shakeTimeAntibiotic: float = 1;
	private static var shakeAmountAntibiotic : float = 0.05;
	
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
	
	public static function AntibioticShake(){
		iTween.ShakePosition(myGameObject, Vector3(shakeAmountAntibiotic,shakeAmountAntibiotic,0), shakeTimeAntibiotic);
	}

}//End of class