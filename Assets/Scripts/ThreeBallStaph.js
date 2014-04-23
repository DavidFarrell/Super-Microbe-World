#pragma strict

public class ThreeBallStaph extends WalkingMicrobe {

	/*	This class will implement the special features that the three ball staphilococus (sandy, slarg) have.
		Basically, their different behaviour is when they reach some ledge. They will play the bounce animation and turn.
	*/

	protected function LedgeReached(){
//		Debug.Log("Three ball staphilococus: Ledge reached");
		
		anim.SetTrigger("bounce");
		
		StopThenFlip ();					//For the microbes that don't jump
		
	}

}//End of class