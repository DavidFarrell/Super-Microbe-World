#pragma strict

private var anim: Animator;

function Start () {

	anim = transform.GetComponent(Animator);	//To store the animator

}

function Update () {

}

function OnCollisionEnter2D (coll: Collision2D) {

	beHit();

}

//To play the be_photographed animation
function bePhotographed () {

	anim.SetTrigger("be_photographed");

}

function beHit () {

	anim.SetTrigger("be_hit");

}

function beKilled () {

	anim.SetTrigger("be_killed");

}

function stare () {

	anim.SetTrigger("stare");
	
}