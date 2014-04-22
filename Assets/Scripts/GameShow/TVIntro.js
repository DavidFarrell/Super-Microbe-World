#pragma strict

private var canSkip: boolean = false;
private var clickEnabled: boolean = false;

//function Awake(){
//}

function Start () {

}

function Update () {
	if(clickEnabled && Input.anyKeyDown){
			canSkip = true;
			Debug.Log("Destroying TVIntro...");
			Destroy(gameObject);
	}
}

function enableClick(){
	clickEnabled = true;	
}

public function finishedTVIntro(){
	while (!canSkip) yield new WaitForSeconds(0.2);
	Debug.Log("Giving back the control to the LevelLogic script.");
}