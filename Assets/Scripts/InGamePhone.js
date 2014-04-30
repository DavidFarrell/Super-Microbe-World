#pragma strict

public class InGamePhone extends MonoBehaviour{
	private var GUIHandlerScript: GUIHandler;
	function Start () {

	}

	function Update () {

	}
	
	public function ShowPhoneInfo(){
	
	Debug.LogError("This function should not be used!");
	
//		//Call the GUIHandler info
//		//This function is called from
//		
//		if(!GUIHandlerScript){
//			var GUIHandlerScript : GUIHandler = transform.parent.gameObject.GetComponent("GUIHandler");		//Getting the script (GUIHancler) of the parent GameObject (GUI)
//			if (!GUIHandlerScript) Debug.LogError("InGamePhone.js: GUIHandler Script not found. This will cause issues when displaying the GUI over the phone.");
//			else{
//				GUIHandlerScript.ShowPhoneInfo();
//			}
//		}
//		else{
//			GUIHandlerScript.ShowPhoneInfo();
//		}
//		Debug.Log("InGamePhone.js: ShowPhoneInfo() called.");
	}//End of function
	
}//End of class