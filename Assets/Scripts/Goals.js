#pragma strict

public class Goals extends MonoBehaviour{
	
	/*
	The purpose of this class is to keep the goals of a level of the game. It will be used in the level logic script of each platform level.
	
	How it works?
	
		-This script must be attached to the GameLogic GameObject, so it can be accessed by all the microbes' scripts and the script that manages the logic of the level.
		-From the script that controls the logic of the level we can: 
			-Set new goals with SetGoals("lucy", "photo", 3). Doing that will add the goal of taking pictures of three different lucy bacteria.
			-The UpdateGoals() function has to be used from the microbes' scripts to update the goals. Doing so if we have to take one photograph to lucy and we use UpdateGoals("lucy", "photo"), we'll have completed that goal
			-The GoalsAchieved() function will return true when all the goals added have been completed. So it will be used from the portal of the level to decide whether to go on the next level or not.
		
		-IMPORTANT to take a look on the function NameToNumber() to know which names have to be passed to the functions SetGoals() and UpdateGoals(). Incorrect names will result on an error.
	*/
	
	private var counterChanged : boolean;	//This boolean will be used to know when we have or when we have not to check the counter array to look if it has zero on all its positions. Will 
											//have true value if there are changes in the counter matrix or false if there isn't any change since last time it was checked with the GoalsAchieved() function.
	private var goalsRemaining: boolean = false;	//When there's at least one goal to be completed this will be true. False in other case.
	public var counter : int[,]= new int [12, 5];	
	/*This matrix will contain one row per microbe. Each row refers to the information of a microbe. 
	In each row, the position 0 is for the number of photographs of this microbe needed, the position 1 for the number of deaths caused by being washed away, 
	the position 2 for the deaths by white blood cells, the position 3 for the number of deaths caused by antibiotics, and the last one, the 4th position, the number of lucy bacteria that need to be 
	pushed to the yoghourt. 
	Here is the correspondence with numbers and microbes: 
		00 lucy
		01 patty
		02 donna
		03 slarg
		04 slurm
		05 colin
		06 super_colin
		07 sandy
		08 steve
		09 iggy
		10 super_slurm
		11 superinfection
	For example, if the 5th row is [0, 3, 0, 0, 0] that means that to complete this level, we need to wash away 3 colin microbes.
	*/
	
	function Awake () {		//Initialize the matrix to zero
		counterChanged = true;
		goalsRemaining = false;
		for (var i : int = 0; i < 12; i++){		//To iterate over the microbes
			for (var j : int = 0; i < 5; i++){	//To iterate over the actions
				counter[i,j] = 0;
			}
		}
	}
	
	function Start () {
		//Not used
	}

	function Update () {
		//Not used
	}
	
	public function SetGoals(microbe: String, action: String, times: int){		//Sets the times that the action needs to be performed to the microbe to progress on the level.
//		counter[0, 0] = 3;				//We'll need to photograph 3 different lucy bacteria to complete the level
		
		var numbers: Pair = NameToNumber(microbe, action);	//To convert the names of microbe and action to its coordinates in the matrix
		
		goalsRemaining = true;	//From now on there will be at least one goal
		
		counter[numbers.micNumber, numbers.actNumber] = times;					//Sets the times that the action needs to be performed to the microbe to progress on the level.
		
//		Debug.Log("Setting goal: Microbe: " + microbe + ". Action: " + action + ". Times:" + times + ". Converted numbers: Microbe: " + numbers.micNumber +" Action: "+ numbers.actNumber);
		
		//Debug.Log("Number of yoghurts lucy: " + counter[0, 4]);
		GUITextGoalsInfo.SetInfoGoals(microbe, counter[numbers.micNumber, 0], counter[numbers.micNumber, 1], counter[numbers.micNumber, 2], counter[numbers.micNumber, 3], counter[numbers.micNumber, 4]);	//To update the GUI
		
		counterChanged = true;
	}
	
	public function GoalsAchieved() : boolean {
//		Debug.Log("goalsRemaining: " + goalsRemaining + "counterChanged" + counterChanged);
		if(goalsRemaining && counterChanged){							//If there is no changes on the matrix is useless to check if there is all the goals have been achieved
			for (var i : int = 0; i < 10; i++){
				for (var j : int = 0; j < 5; j++){
					//Debug.Log("Checking position "+ i +", " + j);
					//if(i == 0 && j == 4) Debug.Log("*****Number of yoghurts lucy: " + counter[i, j]);
					if (counter[i,j] != 0) {
						counterChanged = false;		//This "if" won't be executed again unless counterChanged is set to true again. counterChanged will be changed to true when the counter matrix suffers any change.
//						Debug.Log("***Checking loop...*** There is still some goal that need to be completed. This is the first (maybe not only) one -> Bug: " + i + ". Action: " + j);
						GUITextGoalsInfo.SetInfoGoals(i.ToString(), counter[i, 0], counter[i, 1], counter[i, 2], counter[i, 3], counter[i, 4]);	//To update the GUI. Note that this will display a number instead of the name of the bug. when changing the strings to enums to keep the name of the microbes this will change
						return false;	//If there is any position different from 0, there is at least one goal without accomplish					
					}
				}
			}
			counterChanged = false;
//			Debug.Log("****All goals completed!**** All the matrix was checked.");
			goalsRemaining = false;					//Once there is no goals this variable will be false to avoid checking again the matrix
			return true;
		}
		else{
			if (!goalsRemaining) {
//				Debug.Log("GoalsAchieved(): There is't goals. Matrix was't checked but goalsRemaining was false.");
				return true;
			}
			else return false;
		}
	}
	
	public function UpdateGoals(microbe: String, action: String){
		//Will be called from the microbes' scripts when the microbe is photographed, washed away, killed by a white blood cell or by antibiotic, or pushed to the yoghourt. 
		//The first parameter is to say the name of the microbe that suffered the action, and the second is for the action itself. 
		//The parameters must take the values contained in the switch statements
		
		var numbers: Pair = NameToNumber(microbe, action);	//To convert the names of microbe and action to its coordinates in the matrix
		
//		Debug.Log("Goal achieved: Microbe: " + microbe + ". Action: " + action);
		
		if (counter[numbers.micNumber, numbers.actNumber] > 0) { 
			counter[numbers.micNumber, numbers.actNumber]--;	//One goal achieved, one goal less to accomplish.
			GUITextGoalsInfo.SetInfoGoals(microbe, counter[numbers.micNumber, 0], counter[numbers.micNumber, 1], counter[numbers.micNumber, 2], counter[numbers.micNumber, 3], counter[numbers.micNumber, 4]);	//To update the GUI.
			counterChanged = true;	//The next time that we call GoalsAchieved function, the matrix will be checked
		}
	}
	
	private class Pair{
		//Class to encapsule the two numbers for the microbe and action
		public var micNumber: int;		//To keep the number of microbe
		public var actNumber: int;		//To keep the action to perform/ performed
		public function Pair(num1: int, num2: int){
			micNumber = num1;
			actNumber = num2;
		}
	}
	
	private function NameToNumber(microbe: String, action: String): Pair{
		
		//TODO Change strings to Enum types to avoid errors. Doing so will make this function useless.
		
		//Takes the name of a microbe and an action and returns its positions in the "counter" matrix.
		//For instance: "lucy", "photo" in the microbe, action parameters will return 0, 0 in the mic and act parameters, that are the coordinates of the number of photos that left to be shooted to lucy. 
		//If mic or act values are -1 that means that there has been an error when converting the numbers to its references in the array.
		
		var result : Pair = new Pair(-1, -1);
		
		switch(microbe){
			case "lucy":
				result.micNumber = 0;
				break;
			case "patty": 
				result.micNumber = 1;
				break;
			case "donna": 
				result.micNumber = 2;
				break;
			case "slarg": 
				result.micNumber = 3;
				break;
			case "slurm": 
				result.micNumber = 4;
				break;
			case "colin": 
				result.micNumber = 5;
				break;
			case "super_colin": 
				result.micNumber = 6;
				break;
			case "sandy": 
				result.micNumber = 7;
				break;
			case "steve": 
				result.micNumber = 8;
				break;
			case "iggy": 
				result.micNumber = 9;
				break;
			case "super_slurm": 
				result.micNumber = 10;
				break;
			case 'superinfection':
				result.micNumber = 11;
				break;
			default: result.micNumber = -1;
		}
		switch(action){
			case "photo":
				result.actNumber = 0;
				break;
			case "washed up":
				result.actNumber = 1;
				break;
			case "white blood cell":
				result.actNumber = 2;
				break;
			case "antibiotics":
				result.actNumber = 3;
				break;
			case "thrown to yoghurt":		//This is only for lucy
				result.actNumber = 4;
				break;
			default:
				result.actNumber = -1;
		}
		if (result.actNumber == -1 || result.actNumber == -1) Debug.LogError("Error when reading action or microbe parameters!");
		//Debug.Log("Names converted to this numbers: Microbe:" + result.micNumber + " Action: " + result.actNumber);
		return result;
	}
	
	/*
	private class ActionsLeft{
		public var photos: int;
		public var washedAway: int;
		public var wbc: int;
		public var antibiotics: int;
		
		public function ActionsLeft(){
			photos = 0;
			washedAway = 0;
			wbc = 0;
			antibiotics = 0;
		}
		
		public AnyActionLeft() : boolean{
			return (photos != 0 || washedAway != 0 || wbc != 0 || antibiotics != 0 ||);
		}
	}*/
}