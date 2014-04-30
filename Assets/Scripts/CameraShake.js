#pragma strict

public class CameraShake extends MonoBehaviour{
	
	private static var myGameObject: GameObject;
	private static var camComponent : Camera;
	
	//Zoom feature is not working. It would be easy to fix it, but I'm running out of time. The problem is to get back to the old zoom value of 5. When it's changed to 4 
	private static var zoom : boolean = false;
	private static var OldSize: float;
	private static var secondsToZoom: float = 0.5;
	private static var zoomTo: float = 4;
	private static var currentZoom: float = 0;
	
	private static var shakeTime: float = 3.5;
	private static var shakeAmount : float = 0.1;
	
	private static var shakeTimeAntibiotic: float = 1;
	private static var shakeAmountAntibiotic : float = 0.05;
	
	function Start () {
		myGameObject = gameObject;
		camComponent = myGameObject.GetComponent(Camera);

	}

	function Update () {
//		if (zoom){
//			currentZoom += Time.deltaTime;
//			camComponent.orthographicSize = Mathf.Lerp(OldSize, zoomTo, currentZoom / secondsToZoom);	//This way will linearly interpolate in real time from 0the old zoom to the new one in secondsToZoom seconds
//			
//		}
	}

	public static function ShrinkingZone(){
		if (camComponent){
			Debug.Log("Shaking the camera...");
			
//			OldSize = camComponent.orthographicSize;
//			currentZoom = 0;
//			zoom = true;
			
			yield new WaitForSeconds(0.3);
			
			iTween.ShakePosition(myGameObject, Vector3(shakeAmount,shakeAmount,0), shakeTime);
			
//			yield new WaitForSeconds(5);
			
//			zoom = false;
			
//			yield new WaitForSeconds(0.2);
//			
//			camComponent.orthographicSize = OldSize;
//			
//			Debug.Log("Returning the camera to its normal zoom level");
		}
	}
	
	public static function AntibioticShake(){
		iTween.ShakePosition(myGameObject, Vector3(shakeAmountAntibiotic,shakeAmountAntibiotic,0), shakeTimeAntibiotic);
	}

}//End of class