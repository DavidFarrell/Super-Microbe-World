#pragma strict

public class LevelLogicSkin12 extends LevelLogic{
	
	function Awake () {
		
		super.Awake();
		
	}

	function Start () {
		
		super.Start();
		
//		this.SetPickups(0, 0, 0);
		
		ShowInfoLevel();
	}

//	function Update () {
//
//	}

	protected function AddLevelGoals () {
		//Function to add the goals of this level
		
		goals.SetGoals("slurm", "washed up", 3);
		
	}
	
	public function ShowInfoLevel(){
		super.ShowInfoLevel();
		//yield new WaitForSeconds(0.2);
		GUIHandler.showInfoLevel("skin12", this);		//Plays the instruction animation for this level, the level one.
	}

}	//End of class brace.