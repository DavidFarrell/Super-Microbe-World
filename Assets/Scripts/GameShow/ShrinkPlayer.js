#pragma strict

private var levelLogicScript : LevelLogicGameShow;

function Awake () {

	levelLogicScript = GameObject.Find("LevelLogic").GetComponent(LevelLogicGameShow);

}

function Start () {

}

function Update () {

}

//This function will be called when the shrinking player end its animation to continue with the game.
function EndAnimation(){
	Debug.Log("Shrinking Animation finished. Calling LevelLogicGameShow.ShrinkingZone...");
	levelLogicScript.ShrinkingZone();		//To continue this method where it yielded
}