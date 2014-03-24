#pragma strict

public class LevelLogicKitchen31 extends LevelLogic{
	
	function Awake () {
		
		super.Awake();
		
	}

	function Start () {
		
		super.Start();
		//this.SetPickups(0, 0, 0);
		ShowInfoLevel();
	}

//	function Update () {
//
//	}

	protected function AddLevelGoals () {
		//Function to add the goals of this level
		
		
		goals.SetGoals("lucy", "thrown to yoghurt", 1);			//The goal will be to push 2 lucy bacteria to the yoghurt

	}
	
	public function ShowInfoLevel(){
		super.ShowInfoLevel();
		//yield new WaitForSeconds(0.2);
		GUIHandler.showInfoLevel("kitchen31", this);		//Plays the instruction animation for this level, the level one.
	}

}	//End of class brace.
