#pragma strict

public class LevelLogicKitchen31 extends LevelLogic{
	
	function Awake () {
		
		super.Awake();
		
	}

	function Start () {
		
		super.Start();
		
	}

//	function Update () {
//
//	}

	protected function AddLevelGoals () {
		//Function to add the goals of this level
		
		
		goals.SetGoals("lucy", "thrown to yoghurt", 2);			//The goal will be to push 2 lucy bacteria to the yoghurt

	}

}	//End of class brace.
