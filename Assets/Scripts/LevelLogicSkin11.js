#pragma strict

public class LevelLogicSkin11 extends LevelLogic{
	
	function Awake () {
		
		super.Awake();
		
	}

	function Start () {
		
		super.Start();
		
		this.SetPickups(0, 0, 0);
		
	}

//	function Update () {
//
//	}

	protected function AddLevelGoals () {
		//Function to add the goals of this level
		
		goals.SetGoals("slurm", "washed up", 3);
		
	}

}	//End of class brace.