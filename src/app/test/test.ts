import { Component } from '@angular/core';
import {ButtonModule } from 'primeng/button';
import { DsPriorityBadge, DsStatusPill } from '../shared/ui';

@Component({
  imports: [ButtonModule, DsPriorityBadge, DsStatusPill],
  selector: 'app-test',
  styleUrl: './test.css',
  templateUrl: './test.html',
})
export class Test {}
